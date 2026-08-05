const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const OTP_LENGTH = 6;
const DEFAULT_OTP_TTL_MINUTES = 10;
const DEFAULT_MAX_ATTEMPTS = 5;

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getPasswordResetTtlMinutes(env = process.env) {
  return getPositiveInteger(env.PASSWORD_RESET_OTP_TTL_MINUTES, DEFAULT_OTP_TTL_MINUTES);
}

function getPasswordResetMaxAttempts(env = process.env) {
  return getPositiveInteger(env.PASSWORD_RESET_OTP_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
}

function generatePasswordResetOtp() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function isPasswordResetOtpFormat(value) {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(value || ''));
}

function getPasswordResetExpiry(now = new Date(), env = process.env) {
  return new Date(now.getTime() + getPasswordResetTtlMinutes(env) * 60 * 1000);
}

function hashPasswordResetOtp(otp) {
  return bcrypt.hash(otp, 12);
}

function verifyPasswordResetOtp(otp, otpHash) {
  if (!otpHash || !isPasswordResetOtpFormat(otp)) return false;
  return bcrypt.compare(otp, otpHash);
}

module.exports = {
  generatePasswordResetOtp,
  getPasswordResetExpiry,
  getPasswordResetMaxAttempts,
  getPasswordResetTtlMinutes,
  hashPasswordResetOtp,
  isPasswordResetOtpFormat,
  verifyPasswordResetOtp,
};
