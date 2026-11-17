import { escapeHtml } from '../utils/html';

interface AuthPageOptions {
  path: string;
  error?: string;
  success?: string;
  loading?: boolean;
  fieldErrors?: Record<string, string>;
}

function fieldError(errors: Record<string, string>, field: string): string {
  return errors[field] ? `<span id="${field}-error" class="form-error" data-error-for="${field}">${escapeHtml(errors[field])}</span>` : '';
}

function authShell(title: string, subtitle: string, form: string, footer: string, options: AuthPageOptions): string {
  return `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-brand"><span class="brand-mark" aria-hidden="true"></span><span>ResaleIQ</span></div>
        <h1 id="auth-title">${title}</h1>
        <p class="auth-subtitle">${subtitle}</p>
        ${options.error ? `<div class="form-alert form-alert-error" role="alert">${escapeHtml(options.error)}</div>` : ''}
        ${options.success ? `<div class="form-alert form-alert-success" role="status">${escapeHtml(options.success)}</div>` : ''}
        ${form}
        <div class="auth-footer">${footer}</div>
      </section>
    </main>
  `;
}

export function renderLoginPage(options: AuthPageOptions = { path: '/login' }): string {
  return authShell(
    'Welcome back',
    'Sign in to continue your resale research.',
    `<form class="auth-form" data-auth-form="login" novalidate>
      <label class="form-field"><span>Email</span><input name="email" type="email" autocomplete="email" required aria-describedby="email-error" />${fieldError(options.fieldErrors ?? {}, 'email')}</label>
      <label class="form-field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required aria-describedby="password-error" />${fieldError(options.fieldErrors ?? {}, 'password')}</label>
      <div class="auth-inline"><a href="/forgot-password" data-path="/forgot-password">Forgot password?</a></div>
      <button class="button button-primary auth-submit" type="submit"${options.loading ? ' disabled' : ''}>${options.loading ? 'Signing in…' : 'Sign in'}</button>
    </form>`,
    `New to ResaleIQ? <a href="/register" data-path="/register">Create an account</a>`,
    options,
  );
}

export function renderRegisterPage(options: AuthPageOptions = { path: '/register' }): string {
  return authShell(
    'Create your account',
    'Start researching and managing your resale inventory.',
    `<form class="auth-form" data-auth-form="register" novalidate>
      <label class="form-field"><span>Display name</span><input name="displayName" type="text" autocomplete="name" required aria-describedby="displayName-error" />${fieldError(options.fieldErrors ?? {}, 'displayName')}</label>
      <label class="form-field"><span>Email</span><input name="email" type="email" autocomplete="email" required aria-describedby="email-error" />${fieldError(options.fieldErrors ?? {}, 'email')}</label>
      <label class="form-field"><span>Password</span><input name="password" type="password" autocomplete="new-password" required aria-describedby="password-error" />${fieldError(options.fieldErrors ?? {}, 'password')}</label>
      <label class="form-field"><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" required aria-describedby="confirmPassword-error" />${fieldError(options.fieldErrors ?? {}, 'confirmPassword')}</label>
      <button class="button button-primary auth-submit" type="submit"${options.loading ? ' disabled' : ''}>${options.loading ? 'Creating account…' : 'Create account'}</button>
    </form>`,
    `Already have an account? <a href="/login" data-path="/login">Sign in</a>`,
    options,
  );
}

export function renderForgotPasswordPage(options: AuthPageOptions = { path: '/forgot-password' }): string {
  return authShell(
    'Reset your password',
    'Enter your email and we’ll send a reset link if an account exists.',
    `<form class="auth-form" data-auth-form="forgot" novalidate>
      <label class="form-field"><span>Email</span><input name="email" type="email" autocomplete="email" required aria-describedby="email-error" />${fieldError(options.fieldErrors ?? {}, 'email')}</label>
      <button class="button button-primary auth-submit" type="submit"${options.loading ? ' disabled' : ''}>${options.loading ? 'Sending…' : 'Send reset link'}</button>
    </form>`,
    `<a href="/login" data-path="/login">Back to sign in</a>`,
    options,
  );
}

export function renderResetPasswordPage(options: AuthPageOptions = { path: '/reset-password' }): string {
  return authShell(
    'Choose a new password',
    'Use at least 8 characters. Your reset link is handled by Supabase Auth.',
    `<form class="auth-form" data-auth-form="reset" novalidate>
      <label class="form-field"><span>New password</span><input name="password" type="password" autocomplete="new-password" required aria-describedby="password-error" />${fieldError(options.fieldErrors ?? {}, 'password')}</label>
      <label class="form-field"><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" required aria-describedby="confirmPassword-error" />${fieldError(options.fieldErrors ?? {}, 'confirmPassword')}</label>
      <button class="button button-primary auth-submit" type="submit"${options.loading ? ' disabled' : ''}>${options.loading ? 'Saving…' : 'Save new password'}</button>
    </form>`,
    `<a href="/login" data-path="/login">Back to sign in</a>`,
    options,
  );
}

export function renderAuthLoadingPage(): string {
  return '<main class="auth-page"><section class="auth-card auth-loading" role="status">Restoring your session…</section></main>';
}
