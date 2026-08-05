const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-task-manager-secret';
const TOKEN_EXPIRES_IN = '7d';

let ensuredAuthColumn = false;

async function ensureAuthColumn() {
  if (ensuredAuthColumn) return;

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'PASSWORD';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
  `);

  ensuredAuthColumn = true;
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      sessionVersion: user.session_version || 0,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function signOAuthState() {
  return jwt.sign(
    {
      purpose: 'google_oauth',
    },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function verifyOAuthState(state) {
  const payload = jwt.verify(state, JWT_SECRET);
  return payload?.purpose === 'google_oauth';
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

async function getUserWithPasswordByEmail(email) {
  await ensureAuthColumn();
  const users = await prisma.$queryRawUnsafe(
    `
      SELECT id, email, name, avatar_url, password_hash, session_version
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    email
  );

  return users[0] || null;
}

async function upsertGoogleUser(profile) {
  await ensureAuthColumn();

  const normalizedEmail = profile.email?.trim().toLowerCase();
  const displayName = profile.name?.trim() || normalizedEmail;

  if (!normalizedEmail) {
    throw new Error('Google profile did not include an email');
  }

  const existingUsers = await prisma.$queryRawUnsafe(
    `
      SELECT id, email, name, avatar_url, google_id, auth_provider, session_version
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    normalizedEmail
  );

  if (existingUsers[0]) {
    const updatedUsers = await prisma.$queryRawUnsafe(
      `
        UPDATE users
        SET
          name = COALESCE(NULLIF($2, ''), name),
          avatar_url = COALESCE($3, avatar_url),
          google_id = $4,
          auth_provider = 'GOOGLE'
        WHERE id = $1::uuid
        RETURNING id, email, name, avatar_url, session_version
      `,
      existingUsers[0].id,
      displayName,
      profile.picture || null,
      profile.sub || profile.id || null
    );

    return updatedUsers[0];
  }

  const users = await prisma.$queryRawUnsafe(
    `
      INSERT INTO users (email, name, avatar_url, google_id, auth_provider)
      VALUES ($1, $2, $3, $4, 'GOOGLE')
      RETURNING id, email, name, avatar_url, session_version
    `,
    normalizedEmail,
    displayName,
    profile.picture || null,
    profile.sub || profile.id || null
  );

  return users[0];
}

module.exports = {
  comparePassword,
  ensureAuthColumn,
  getUserWithPasswordByEmail,
  hashPassword,
  sanitizeUser,
  signOAuthState,
  signToken,
  upsertGoogleUser,
  verifyOAuthState,
  verifyToken,
};
