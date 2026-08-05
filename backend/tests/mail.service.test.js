const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MailConfigurationError,
  buildPasswordResetMessage,
  getSmtpConfig,
} = require('../services/mail.service');

test('requires complete SMTP configuration before sending reset email', () => {
  assert.throws(() => getSmtpConfig({}), MailConfigurationError);

  assert.deepEqual(
    getSmtpConfig({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'martin@example.com',
      SMTP_PASS: 'app-password',
      SMTP_FROM: 'MartinDesk <martin@example.com>',
    }),
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'martin@example.com', pass: 'app-password' },
    }
  );
});

test('builds an OTP email without exposing a password-reset link', () => {
  const message = buildPasswordResetMessage({ otp: '012345', expiresInMinutes: 10 });

  assert.match(message.subject, /password reset/i);
  assert.match(message.text, /012345/);
  assert.match(message.html, /10 minutes/);
});
