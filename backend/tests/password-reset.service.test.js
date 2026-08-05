const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generatePasswordResetOtp,
  getPasswordResetExpiry,
  getPasswordResetMaxAttempts,
  getPasswordResetTtlMinutes,
  hashPasswordResetOtp,
  isPasswordResetOtpFormat,
  verifyPasswordResetOtp,
} = require('../services/password-reset.service');

test('generates a six-digit numeric password-reset OTP', () => {
  const otp = generatePasswordResetOtp();

  assert.match(otp, /^\d{6}$/);
  assert.equal(isPasswordResetOtpFormat(otp), true);
  assert.equal(isPasswordResetOtpFormat('12345'), false);
  assert.equal(isPasswordResetOtpFormat('1234567'), false);
  assert.equal(isPasswordResetOtpFormat('ABC123'), false);
});

test('hashes OTPs and only verifies the original six-digit value', async () => {
  const otpHash = await hashPasswordResetOtp('012345');

  assert.notEqual(otpHash, '012345');
  assert.equal(await verifyPasswordResetOtp('012345', otpHash), true);
  assert.equal(await verifyPasswordResetOtp('012346', otpHash), false);
  assert.equal(await verifyPasswordResetOtp('not-an-otp', otpHash), false);
});

test('uses safe default reset expiry and attempt limits', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  const expiry = getPasswordResetExpiry(now, {});

  assert.equal(getPasswordResetTtlMinutes({}), 10);
  assert.equal(getPasswordResetMaxAttempts({}), 5);
  assert.equal(expiry.toISOString(), '2026-08-05T00:10:00.000Z');
  assert.equal(getPasswordResetTtlMinutes({ PASSWORD_RESET_OTP_TTL_MINUTES: '20' }), 20);
  assert.equal(getPasswordResetMaxAttempts({ PASSWORD_RESET_OTP_MAX_ATTEMPTS: '3' }), 3);
});
