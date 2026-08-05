const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createRateLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message },
  });
}

function getAllowedOrigins() {
  const configuredOrigins = parseCsv(process.env.CORS_ORIGIN);
  const frontendUrl = process.env.FRONTEND_URL;

  return configuredOrigins.length > 0
    ? configuredOrigins
    : [
        frontendUrl,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ].filter(Boolean);
}

function configureSecurity(app) {
  const allowedOrigins = getAllowedOrigins();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(
    expressJson({
      limit: process.env.JSON_BODY_LIMIT || '1mb',
    })
  );
}

function expressJson(options) {
  return [
    express.json(options),
    express.urlencoded({ extended: false, limit: options.limit }),
  ];
}

const generalLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parsePositiveInt(process.env.RATE_LIMIT_MAX, 600),
  message: 'Too many requests. Please slow down.',
});

const authLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 30),
  message: 'Too many authentication attempts. Try again later.',
});

const aiLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  limit: parsePositiveInt(process.env.AI_RATE_LIMIT_MAX, 20),
  message: 'Too many AI requests. Try again later.',
});

const uploadLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parsePositiveInt(process.env.UPLOAD_RATE_LIMIT_MAX, 80),
  message: 'Too many upload requests. Try again later.',
});

module.exports = {
  aiLimiter,
  authLimiter,
  configureSecurity,
  generalLimiter,
  getAllowedOrigins,
  uploadLimiter,
};
