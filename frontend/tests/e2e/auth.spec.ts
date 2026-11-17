import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const password = 'LocalTestPassword123!';
let admin: SupabaseClient;
let testEmail = '';

test.beforeAll(async () => {
  if (!url.includes('127.0.0.1') || !serviceRoleKey) throw new Error('Playwright auth tests require local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Load them from `supabase status -o env`; no remote credentials are accepted.');
  admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  testEmail = `playwright-${Date.now()}@example.test`;
  const { error } = await admin.auth.admin.createUser({ email: testEmail, password, email_confirm: true, user_metadata: { display_name: 'Playwright User' } });
  if (error) throw error;
});

test.afterAll(async () => {
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((candidate) => candidate.email === testEmail);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
});

test('register request shows a confirmation message', async ({ page }) => {
  await page.goto('/register');
  const email = `register-${Date.now()}@example.test`;
  await page.getByLabel('Display name').fill('Register User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.form-alert-success')).toContainText('Check your email');
});

test('login and logout use the real Supabase session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Welcome back, Playwright User')).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('protected routes redirect unauthenticated visitors', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login$/);
});

test('password reset request uses a non-enumerating success message', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('unknown@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('.form-alert-success')).toContainText('If an account exists');
});
