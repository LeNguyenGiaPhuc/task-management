const nodemailer = require('nodemailer');

class MailConfigurationError extends Error {
  constructor() {
    super('Password reset email is not configured yet.');
    this.name = 'MailConfigurationError';
  }
}

function getSmtpConfig(env = process.env) {
  const { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_USER } = env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new MailConfigurationError();
  }

  const port = Number.parseInt(env.SMTP_PORT || '587', 10);

  return {
    host: SMTP_HOST,
    port: Number.isInteger(port) ? port : 587,
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  };
}

function buildPasswordResetMessage({ otp, expiresInMinutes }) {
  return {
    subject: 'MartinDesk password reset code',
    text: `Your MartinDesk password reset code is ${otp}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
        <p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#2563eb;text-transform:uppercase">MartinDesk access</p>
        <h1 style="font-size:24px">Reset your password</h1>
        <p>Use this one-time code to set a new password:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  };
}

async function sendPasswordResetOtpEmail({ email, otp, expiresInMinutes, env = process.env }) {
  const transporter = nodemailer.createTransport(getSmtpConfig(env));
  const message = buildPasswordResetMessage({ otp, expiresInMinutes });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    ...message,
  });
}

module.exports = {
  MailConfigurationError,
  buildPasswordResetMessage,
  getSmtpConfig,
  sendPasswordResetOtpEmail,
};
