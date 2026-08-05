const AUTH_COOKIE_NAME = 'task_manager_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isSecureCookie(environment = process.env) {
  if (environment.COOKIE_SECURE === 'true') return true;
  if (environment.COOKIE_SECURE === 'false') return false;
  return environment.NODE_ENV === 'production';
}

function getAuthCookieOptions(environment = process.env) {
  const secure = isSecureCookie(environment);

  return {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...cookieOptions } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(';')) {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = item.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(item.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function getRequestToken(headers = {}) {
  const cookieToken = readCookie(headers.cookie, AUTH_COOKIE_NAME);
  if (cookieToken) return { source: 'cookie', token: cookieToken };

  const authorization = headers.authorization || '';
  if (authorization.startsWith('Bearer ')) {
    return { source: 'bearer', token: authorization.slice(7) };
  }

  return { source: null, token: null };
}

function hasTrustedOrigin(headers = {}, allowedOrigins = []) {
  const source = headers.origin || headers.referer;
  if (!source) return false;

  try {
    return allowedOrigins.includes(new URL(source).origin);
  } catch {
    return false;
  }
}

module.exports = {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  clearAuthCookie,
  getAuthCookieOptions,
  getRequestToken,
  hasTrustedOrigin,
  readCookie,
  setAuthCookie,
};
