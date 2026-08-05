const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getRequestToken,
  hasTrustedOrigin,
  readCookie,
} = require('../utils/auth-session');

test('uses an HttpOnly cross-site cookie in production', () => {
  const options = getAuthCookieOptions({ NODE_ENV: 'production' });

  assert.deepEqual(options, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    sameSite: 'none',
    secure: true,
  });
});

test('uses a local-development cookie that works over HTTP', () => {
  const options = getAuthCookieOptions({ NODE_ENV: 'development' });

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.secure, false);
});

test('reads the cookie session before a legacy Bearer token', () => {
  const token = getRequestToken({
    authorization: 'Bearer legacy-token',
    cookie: `theme=dark; ${AUTH_COOKIE_NAME}=cookie-token`,
  });

  assert.deepEqual(token, { source: 'cookie', token: 'cookie-token' });
  assert.equal(readCookie('other=value', AUTH_COOKIE_NAME), null);
});

test('accepts only the configured frontend origin for cookie writes', () => {
  const allowedOrigins = ['https://martindesk.example'];

  assert.equal(
    hasTrustedOrigin({ origin: 'https://martindesk.example' }, allowedOrigins),
    true
  );
  assert.equal(
    hasTrustedOrigin({ referer: 'https://martindesk.example/boards/1' }, allowedOrigins),
    true
  );
  assert.equal(
    hasTrustedOrigin({ origin: 'https://attacker.example' }, allowedOrigins),
    false
  );
});
