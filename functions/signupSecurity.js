import crypto from 'node:crypto';

const SIGNUP_EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$/;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
}

function cleanUrl(value) {
  const cleaned = cleanString(value, 500);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSignupEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidSignupEmail(email) {
  return email.length <= 320 && SIGNUP_EMAIL_REGEX.test(email);
}

export function sanitizeSignupAttribution(value) {
  const attribution = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const utmInput = attribution.utm && typeof attribution.utm === 'object' && !Array.isArray(attribution.utm)
    ? attribution.utm
    : {};
  const utm = Object.fromEntries(
    UTM_KEYS
      .map((key) => [key, cleanString(utmInput[key], 120)])
      .filter(([, entry]) => entry)
  );

  return {
    locale: cleanString(attribution.locale, 32),
    referrer: cleanUrl(attribution.referrer),
    sourceUrl: cleanUrl(attribution.sourceUrl),
    ...(Object.keys(utm).length ? { utm } : {}),
  };
}

export function hashSignupEmail(email) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

export function hashSignupIp(ip, secret) {
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

export function getClientIp(req) {
  return cleanString(req.ip, 128) || 'unknown';
}

export function isSuspiciousSignupTiming(startedAt, now = Date.now()) {
  const timestamp = Number(startedAt);
  if (!Number.isFinite(timestamp)) return true;
  const elapsed = now - timestamp;
  return elapsed < 1200 || elapsed > 24 * 60 * 60 * 1000;
}

export function buildSignupRateLimitIds({ emailHash, ipHash, now = new Date() }) {
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  return {
    ip: `ip_${ipHash}_${hour}`,
    email: `email_${emailHash}`,
    daily: `daily_${day}`,
  };
}

export function buildConfirmationToken(emailHash) {
  return `${emailHash}.${crypto.randomBytes(32).toString('base64url')}`;
}

export function parseConfirmationToken(token) {
  if (typeof token !== 'string' || token.length > 256) return null;
  const [emailHash, secret, extra] = token.split('.');
  if (extra || !/^[a-f0-9]{64}$/.test(emailHash || '') || !/^[A-Za-z0-9_-]{40,64}$/.test(secret || '')) {
    return null;
  }
  return { emailHash, token };
}

export function safeTokenHashMatches(token, expectedHash) {
  const actual = Buffer.from(hashSignupEmail(token), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
