import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConfirmationToken,
  buildSignupRateLimitIds,
  hashSignupEmail,
  isSuspiciousSignupTiming,
  isValidSignupEmail,
  normalizeSignupEmail,
  parseConfirmationToken,
  safeTokenHashMatches,
  sanitizeSignupAttribution,
} from './signupSecurity.js';

test('normalizes and validates signup email addresses', () => {
  const email = normalizeSignupEmail('  Person+News@Example.COM ');
  assert.equal(email, 'person+news@example.com');
  assert.equal(isValidSignupEmail(email), true);
  assert.equal(isValidSignupEmail('missing-domain'), false);
});

test('allowlists and bounds attribution fields', () => {
  const attribution = sanitizeSignupAttribution({
    locale: 'en-US',
    sourceUrl: 'https://arcade.earth/?utm_source=test',
    referrer: 'javascript:alert(1)',
    unexpected: 'discard me',
    utm: { utm_source: 'newsletter', bad: 'discard me' },
  });
  assert.deepEqual(attribution, {
    locale: 'en-US',
    sourceUrl: 'https://arcade.earth/?utm_source=test',
    referrer: null,
    utm: { utm_source: 'newsletter' },
  });
});

test('flags impossibly fast and stale form submissions', () => {
  const now = Date.now();
  assert.equal(isSuspiciousSignupTiming(now - 200, now), true);
  assert.equal(isSuspiciousSignupTiming(now - 3000, now), false);
  assert.equal(isSuspiciousSignupTiming(now - 25 * 60 * 60 * 1000, now), true);
});

test('creates stable privacy-safe rate-limit bucket ids', () => {
  const ids = buildSignupRateLimitIds({
    emailHash: 'e'.repeat(64),
    ipHash: 'i'.repeat(64),
    now: new Date('2026-08-11T17:42:00.000Z'),
  });
  assert.equal(ids.ip, `ip_${'i'.repeat(64)}_2026-08-11T17`);
  assert.equal(ids.email, `email_${'e'.repeat(64)}`);
  assert.equal(ids.daily, 'daily_2026-08-11');
});

test('confirmation tokens identify their pending record and compare by hash', () => {
  const emailHash = hashSignupEmail('person@example.com');
  const token = buildConfirmationToken(emailHash);
  assert.deepEqual(parseConfirmationToken(token), { emailHash, token });
  assert.equal(safeTokenHashMatches(token, hashSignupEmail(token)), true);
  assert.equal(safeTokenHashMatches(`${token}x`, hashSignupEmail(token)), false);
  assert.equal(parseConfirmationToken('bad-token'), null);
});
