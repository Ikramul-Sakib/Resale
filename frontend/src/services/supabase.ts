import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  default_currency: string;
  preferences: Record<string, unknown>;
}

export type BrowserSupabaseClient = SupabaseClient<any, 'public', any>;

let client: BrowserSupabaseClient | undefined;

export function getSupabaseClient(): BrowserSupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('Supabase browser configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}

export interface AuthContext {
  user: User;
  profile: Profile | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthService {
  getContext(): Promise<AuthContext | null>;
  register(input: RegisterInput): Promise<{ context: AuthContext | null; needsEmailConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<AuthContext>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateProfile(input: { display_name: string; default_currency: string }): Promise<Profile>;
  changePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (context: AuthContext | null) => void): () => void;
}

async function loadProfile(supabase: BrowserSupabaseClient, user: User): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error('Unable to load your profile.');
  return data as Profile | null;
}

async function loadContext(supabase: BrowserSupabaseClient): Promise<AuthContext | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Unable to restore your session.');
  if (!data.session?.user) return null;
  return { user: data.session.user, profile: await loadProfile(supabase, data.session.user) };
}

export function createAuthService(supabase: BrowserSupabaseClient): AuthService {
  return {
    async getContext() {
      return loadContext(supabase);
    },

    async register(input) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { display_name: input.displayName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Registration could not be completed.');
      if (!data.session) return { context: null, needsEmailConfirmation: true };
      return { context: { user: data.user, profile: await loadProfile(supabase, data.user) }, needsEmailConfirmation: false };
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message ?? 'Unable to sign in.');
      return { user: data.user, profile: await loadProfile(supabase, data.user) };
    },

    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
    },

    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },

    async updateProfile(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error('Your session has expired. Please sign in again.');
      const { data, error } = await supabase.from('profiles').update(input).eq('id', user.id).select('*').single();
      if (error || !data) throw new Error('Unable to save your profile.');
      return data as Profile;
    },

    async changePassword(password) {
      await this.updatePassword(password);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error('Unable to sign out.');
    },

    onAuthStateChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          callback(null);
          return;
        }
        void loadProfile(supabase, session.user)
          .then((profile) => callback({ user: session.user, profile }))
          .catch(() => callback({ user: session.user, profile: null }));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

export function getAuthService(): AuthService {
  return createAuthService(getSupabaseClient());
}
