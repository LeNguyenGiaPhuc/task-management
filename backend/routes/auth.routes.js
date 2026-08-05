const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth.middleware');
const { clearAuthCookie, setAuthCookie } = require('../utils/auth-session');
const {
  comparePassword,
  ensureAuthColumn,
  getUserWithPasswordByEmail,
  hashPassword,
  sanitizeUser,
  signOAuthState,
  signToken,
  upsertGoogleUser,
  verifyOAuthState,
} = require('../services/auth.service');
const {
  generatePasswordResetOtp,
  getPasswordResetExpiry,
  getPasswordResetMaxAttempts,
  getPasswordResetTtlMinutes,
  hashPasswordResetOtp,
  isPasswordResetOtpFormat,
  verifyPasswordResetOtp,
} = require('../services/password-reset.service');
const {
  MailConfigurationError,
  sendPasswordResetOtpEmail,
} = require('../services/mail.service');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

function redirectToFrontend(res, params) {
  const url = new URL(FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  res.redirect(url.toString());
}

function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: GOOGLE_CALLBACK_URL,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = name?.trim();

    if (!normalizedEmail || !trimmedName || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and 6+ character password are required' });
    }

    await ensureAuthColumn();
    const existingUser = await getUserWithPasswordByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await hashPassword(password);
    const users = await prisma.$queryRawUnsafe(
      `
        INSERT INTO users (email, name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, avatar_url
      `,
      normalizedEmail,
      trimmedName,
      passwordHash
    );
    const user = sanitizeUser(users[0]);
    const token = signToken(users[0]);

    setAuthCookie(res, token);
    res.status(201).json({ user });
  } catch (error) {
    console.error('POST /api/auth/register failed:', error);
    res.status(500).json({ error: 'Server error while registering' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getUserWithPasswordByEmail(normalizedEmail);
    const isValidPassword = await comparePassword(password, user?.password_hash);

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const cleanUser = sanitizeUser(user);
    const token = signToken(user);

    setAuthCookie(res, token);
    res.status(200).json({ user: cleanUser });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    res.status(500).json({ error: 'Server error while logging in' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    await ensureAuthColumn();
    const user = await getUserWithPasswordByEmail(normalizedEmail);

    if (user?.password_hash) {
      const otp = generatePasswordResetOtp();
      const otpHash = await hashPasswordResetOtp(otp);
      const expiresAt = getPasswordResetExpiry();

      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          'DELETE FROM password_reset_otps WHERE user_id = $1::uuid AND consumed_at IS NULL',
          user.id
        ),
        prisma.$executeRawUnsafe(
          `
            INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
            VALUES ($1::uuid, $2, $3)
          `,
          user.id,
          otpHash,
          expiresAt
        ),
      ]);

      try {
        await sendPasswordResetOtpEmail({
          email: user.email,
          otp,
          expiresInMinutes: getPasswordResetTtlMinutes(),
        });
      } catch (mailError) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM password_reset_otps WHERE user_id = $1::uuid AND otp_hash = $2',
          user.id,
          otpHash
        );
        throw mailError;
      }
    }

    return res.status(200).json({
      message: 'If a password account exists for that email, an OTP has been sent.',
    });
  } catch (error) {
    if (error instanceof MailConfigurationError) {
      return res.status(503).json({ error: error.message });
    }

    console.error('POST /api/auth/forgot-password failed:', error);
    return res.status(500).json({ error: 'Could not send a password reset email. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const password = req.body.password;

    if (!normalizedEmail || !isPasswordResetOtpFormat(otp) || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email, a valid 6-digit OTP, and a 6+ character password are required' });
    }

    await ensureAuthColumn();
    const user = await getUserWithPasswordByEmail(normalizedEmail);
    const invalidCodeResponse = { error: 'The OTP is invalid, expired, or has already been used' };

    if (!user?.password_hash) {
      return res.status(400).json(invalidCodeResponse);
    }

    const otpRows = await prisma.$queryRawUnsafe(
      `
        SELECT id, otp_hash, expires_at, attempts
        FROM password_reset_otps
        WHERE user_id = $1::uuid AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      user.id
    );
    const resetOtp = otpRows[0];

    if (!resetOtp || new Date(resetOtp.expires_at).getTime() <= Date.now()) {
      if (resetOtp) {
        await prisma.$executeRawUnsafe(
          'UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1::uuid',
          resetOtp.id
        );
      }
      return res.status(400).json(invalidCodeResponse);
    }

    const maxAttempts = getPasswordResetMaxAttempts();
    if (resetOtp.attempts >= maxAttempts) {
      await prisma.$executeRawUnsafe(
        'UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1::uuid AND consumed_at IS NULL',
        resetOtp.id
      );
      return res.status(400).json(invalidCodeResponse);
    }

    if (!(await verifyPasswordResetOtp(otp, resetOtp.otp_hash))) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE password_reset_otps
          SET
            attempts = attempts + 1,
            consumed_at = CASE WHEN attempts + 1 >= $2 THEN NOW() ELSE consumed_at END
          WHERE id = $1::uuid AND consumed_at IS NULL
        `,
        resetOtp.id,
        maxAttempts
      );
      return res.status(400).json(invalidCodeResponse);
    }

    const passwordHash = await hashPassword(password);
    const appliedReset = await prisma.$transaction(async (transaction) => {
      const consumedRows = await transaction.$queryRawUnsafe(
        `
          UPDATE password_reset_otps
          SET consumed_at = NOW()
          WHERE id = $1::uuid AND consumed_at IS NULL
          RETURNING id
        `,
        resetOtp.id
      );

      if (!consumedRows[0]) return false;

      await transaction.$executeRawUnsafe(
        `
          UPDATE users
          SET password_hash = $2, auth_provider = 'PASSWORD', session_version = session_version + 1, updated_at = NOW()
          WHERE id = $1::uuid
        `,
        user.id,
        passwordHash
      );
      await transaction.$executeRawUnsafe(
        'UPDATE password_reset_otps SET consumed_at = NOW() WHERE user_id = $1::uuid AND consumed_at IS NULL',
        user.id
      );
      return true;
    });

    if (!appliedReset) {
      return res.status(400).json(invalidCodeResponse);
    }

    return res.status(200).json({ message: 'Password reset. You can now sign in.' });
  } catch (error) {
    console.error('POST /api/auth/reset-password failed:', error);
    return res.status(500).json({ error: 'Could not reset the password. Please try again.' });
  }
});

router.get('/google', async (req, res) => {
  try {
    const { clientId, clientSecret, callbackUrl } = getGoogleOAuthConfig();

    if (!clientId || !clientSecret) {
      return redirectToFrontend(res, { auth_error: 'google_oauth_not_configured' });
    }

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('client_id', clientId);
    googleUrl.searchParams.set('redirect_uri', callbackUrl);
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('scope', 'openid email profile');
    googleUrl.searchParams.set('state', signOAuthState());
    googleUrl.searchParams.set('prompt', 'select_account');

    res.redirect(googleUrl.toString());
  } catch (error) {
    console.error('GET /api/auth/google failed:', error);
    res.status(500).json({ error: 'Server error while starting Google login' });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const { clientId, clientSecret, callbackUrl } = getGoogleOAuthConfig();

    if (error) {
      return redirectToFrontend(res, { auth_error: String(error) });
    }

    if (!clientId || !clientSecret) {
      return redirectToFrontend(res, { auth_error: 'google_oauth_not_configured' });
    }

    if (!code || !state || !verifyOAuthState(String(state))) {
      return redirectToFrontend(res, { auth_error: 'invalid_google_oauth_state' });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', await tokenResponse.text());
      return redirectToFrontend(res, { auth_error: 'google_token_exchange_failed' });
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Google profile fetch failed:', await profileResponse.text());
      return redirectToFrontend(res, { auth_error: 'google_profile_fetch_failed' });
    }

    const profile = await profileResponse.json();

    if (profile.email_verified === false) {
      return redirectToFrontend(res, { auth_error: 'google_email_not_verified' });
    }

    const oauthUser = await upsertGoogleUser(profile);
    const user = sanitizeUser(oauthUser);
    const appToken = signToken(oauthUser);

    setAuthCookie(res, appToken);
    redirectToFrontend(res, {});
  } catch (callbackError) {
    console.error('GET /api/auth/google/callback failed:', callbackError);
    redirectToFrontend(res, { auth_error: 'google_login_failed' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = router;
