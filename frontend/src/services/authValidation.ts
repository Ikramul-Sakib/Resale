import { z } from 'zod';

const email = z.string().trim().email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.');

export const loginSchema = z.object({ email, password }).strict();
export const registerSchema = z.object({
  email,
  password,
  confirmPassword: z.string(),
  displayName: z.string().trim().min(1, 'Enter your display name.').max(80, 'Use 80 characters or fewer.'),
}).superRefine((value, context) => {
  password.safeParse(value.password).success || context.addIssue({ code: 'custom', path: ['password'], message: 'Use at least 8 characters.' });
  if (value.password !== value.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
});
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({ password, confirmPassword: z.string() }).superRefine((value, context) => {
  if (value.password !== value.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
});
export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your display name.').max(80, 'Use 80 characters or fewer.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a valid currency.'),
}).strict();
