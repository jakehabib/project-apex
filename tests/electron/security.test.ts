import { describe, expect, it } from 'vitest';
import { isTrustedAppUrl } from '../../electron/security';

const prod = { scheme: 'app', host: 'apex' };

describe('isTrustedAppUrl', () => {
  it('accepts the app renderer', () => {
    expect(isTrustedAppUrl('app://apex/index.html', prod)).toBe(true);
    expect(isTrustedAppUrl('app://apex/assets/x.js?v=1#h', prod)).toBe(true);
  });
  it('rejects everything that merely shares an opaque "null" origin or looks similar', () => {
    for (const bad of [
      'file:///etc/passwd',
      'file:///C:/Users/x/index.html',
      'app://evil/index.html',
      'app://apex.evil.com/',
      'app://user:pw@apex/',
      'apps://apex/',
      'data:text/html,hi',
      'about:blank',
      'javascript:alert(1)',
      'https://apex/',
      'http://localhost:5173/',
      'not a url',
      '',
    ]) {
      expect(isTrustedAppUrl(bad, prod), bad).toBe(false);
    }
  });
  it('in dev, trusts only the exact dev server host', () => {
    const dev = { ...prod, devUrl: 'http://localhost:5173' };
    expect(isTrustedAppUrl('http://localhost:5173/', dev)).toBe(true);
    expect(isTrustedAppUrl('http://localhost:5174/', dev)).toBe(false);
    expect(isTrustedAppUrl('app://apex/index.html', dev)).toBe(false);
  });
});
