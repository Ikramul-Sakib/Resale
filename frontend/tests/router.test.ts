import { beforeEach, describe, expect, it } from 'vitest';
import { consumeReturnPath, guardRoute, rememberReturnPath } from '../src/router';

describe('route guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('redirects an unauthenticated user to login and remembers the destination', () => {
    const result = guardRoute('/settings', false, false);
    expect(result).toEqual({ path: '/login', redirectFrom: '/settings' });
    rememberReturnPath(result.redirectFrom ?? '');
    expect(consumeReturnPath()).toBe('/settings');
  });

  it('allows demo mode and redirects signed-in users away from login', () => {
    expect(guardRoute('/dashboard', false, true).path).toBe('/dashboard');
    expect(guardRoute('/login', true, false).path).toBe('/dashboard');
  });
});
