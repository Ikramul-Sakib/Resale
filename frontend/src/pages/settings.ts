import type { Profile } from '../services/supabase';
import { renderPageHeader } from '../components/page-header';
import { escapeHtml } from '../utils/html';

interface SettingsOptions {
  email: string;
  profile: Profile | null;
  saving?: boolean;
  passwordSaving?: boolean;
  message?: string;
  error?: string;
}

export function renderSettingsPage(options: SettingsOptions): string {
  const displayName = options.profile?.display_name ?? '';
  const currency = options.profile?.default_currency ?? 'USD';
  return `
    ${renderPageHeader('Settings', 'Manage your account and resale preferences.')}
    ${options.error ? `<div class="form-alert form-alert-error" role="alert">${escapeHtml(options.error)}</div>` : ''}
    ${options.message ? `<div class="form-alert form-alert-success" role="status">${escapeHtml(options.message)}</div>` : ''}
    <section class="settings-grid">
      <article class="card settings-card">
        <div class="card-heading"><h2>Account</h2></div>
        <div class="settings-email"><span>Email</span><strong>${escapeHtml(options.email)}</strong></div>
        <form class="settings-form" data-settings-form novalidate>
          <label class="form-field"><span>Display name</span><input name="displayName" type="text" value="${escapeHtml(displayName)}" autocomplete="name" required /></label>
          <label class="form-field"><span>Preferred currency</span><select name="currency"><option value="USD"${currency === 'USD' ? ' selected' : ''}>USD</option><option value="EUR"${currency === 'EUR' ? ' selected' : ''}>EUR</option><option value="GBP"${currency === 'GBP' ? ' selected' : ''}>GBP</option></select></label>
          <button class="button button-primary" type="submit"${options.saving ? ' disabled' : ''}>${options.saving ? 'Saving…' : 'Save profile'}</button>
        </form>
      </article>
      <article class="card settings-card">
        <div class="card-heading"><h2>Change password</h2></div>
        <form class="settings-form" data-password-form novalidate>
          <label class="form-field"><span>New password</span><input name="password" type="password" autocomplete="new-password" required /></label>
          <label class="form-field"><span>Confirm new password</span><input name="confirmPassword" type="password" autocomplete="new-password" required /></label>
          <button class="button button-secondary" type="submit"${options.passwordSaving ? ' disabled' : ''}>${options.passwordSaving ? 'Updating…' : 'Change password'}</button>
        </form>
      </article>
    </section>
  `;
}
