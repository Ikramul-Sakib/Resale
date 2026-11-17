import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const password = 'LocalTestPassword123!';
let admin: SupabaseClient;
let testEmail = '';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

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

test('uploads a mock-adapter image, supports removal, and shows identification results', async ({ page }) => {
  await login(page);
  await page.goto('/scan');
  const fixture = path.resolve(process.cwd(), '../docs/design/01-dashboard.png');
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await expect(page.getByText('1/6')).toBeVisible();
  await page.getByRole('button', { name: /Remove/ }).click();
  await expect(page.getByText('No photos selected yet.')).toBeVisible();
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Identify & Estimate Price' }).click();
  await expect(page).toHaveURL(/\/identification$/);
  await expect(page.getByRole('alert')).toContainText('Demo mock result — no Gemini call was made');
  await expect(page.getByText(/not a verified match/)).toBeVisible();
});

test('shows a safe failed-scan state with retry affordance', async ({ page }) => {
  await login(page);
  await page.goto('/scan');
  const fixture = path.resolve(process.cwd(), '../docs/design/01-dashboard.png');
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await page.route('**/api/v1/scans', async (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'GEMINI_UNAVAILABLE', message: 'Gemini is temporarily unavailable. Please try again.', request_id: 'e2e' , details: { scan_id: '20000000-0000-4000-8000-0000000000b1' } } }),
  }));
  await page.getByRole('button', { name: 'Identify & Estimate Price' }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini is temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Retry scan' })).toBeVisible();
});

test('edits a confirmed item, gets a mock estimate, and saves it to inventory', async ({ page }) => {
  await login(page);
  await page.goto('/scan');
  const fixture = path.resolve(process.cwd(), '../docs/design/01-dashboard.png');
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Identify & Estimate Price' }).click();
  await expect(page).toHaveURL(/\/identification$/);
  await page.getByLabel('Product name').fill('Confirmed demo product');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Identification changes saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Price Estimation' }).click();
  await expect(page).toHaveURL(/\/estimate$/);
  await expect(page.getByText('AI preliminary estimate')).toBeVisible();
  await expect(page.locator('b', { hasText: 'not connected' })).toBeVisible();
  await page.getByLabel('Suggested selling price').fill('31');
  await page.getByRole('button', { name: 'Save to Inventory' }).click();
  await expect(page.getByText('Saved to inventory.')).toBeVisible();
});

test('shows a failed estimate and retries it', async ({ page }) => {
  await login(page);
  await page.goto('/scan');
  const fixture = path.resolve(process.cwd(), '../docs/design/01-dashboard.png');
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Identify & Estimate Price' }).click();
  await expect(page).toHaveURL(/\/identification$/);
  await page.getByLabel('Product name').fill('Retry demo product');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Identification changes saved.')).toBeVisible();
  await page.route('**/api/v1/items/*/estimate', async (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'GEMINI_UNAVAILABLE', message: 'Gemini is temporarily unavailable. Please try again.' } }) }));
  await page.getByRole('button', { name: 'Continue to Price Estimation' }).click();
  await expect(page.getByRole('heading', { name: 'Estimate unavailable' })).toBeVisible();
  await page.unroute('**/api/v1/items/*/estimate');
  await page.getByRole('button', { name: 'Retry estimate' }).click();
  await expect(page.getByText('AI preliminary estimate')).toBeVisible();
});
