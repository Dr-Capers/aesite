import * as functions from 'firebase-functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { Resend } from 'resend';
import Stripe from 'stripe';
import {
  buildConfirmationToken,
  buildSignupRateLimitIds,
  getClientIp,
  hashSignupEmail,
  hashSignupIp,
  isSuspiciousSignupTiming,
  isValidSignupEmail,
  normalizeSignupEmail,
  parseConfirmationToken,
  safeTokenHashMatches,
  sanitizeSignupAttribution,
} from './signupSecurity.js';

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const googleCloudProject = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'aesite-30f9e';
const recaptchaClient = google.recaptchaenterprise('v1');
const recaptchaAuth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const sheetConfigReady = Boolean(
  process.env.GOOGLE_SHEET_ID &&
    process.env.SERVICE_ACCOUNT_CLIENT_EMAIL &&
    process.env.SERVICE_ACCOUNT_PRIVATE_KEY
);
const SIGNUP_SHEET_RANGE = process.env.GOOGLE_SIGNUPS_SHEET_RANGE || 'Sheet1!A:G';

const sheetsClient = sheetConfigReady ? google.sheets('v4') : null;
const sheetsAuth = sheetConfigReady
  ? new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GCP_PROJECT,
        private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  : null;

const STRIPE_API_VERSION = '2024-12-18.acacia';
const TOKEN_EXPIRY_DAYS = Number(process.env.COMIC_LIBRARY_TOKEN_EXPIRY_DAYS || 14);
const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000;
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const SIGNUP_IP_HASH_SECRET = defineSecret('SIGNUP_IP_HASH_SECRET');
const RESEND_FROM = process.env.RESEND_FROM || 'hello@arcade.earth';
const SUPPORT_EMAIL = process.env.ARCADE_EARTH_SUPPORT_EMAIL || 'hello@arcade.earth';
const FULFILLMENT_NOTIFY_EMAIL = process.env.FULFILLMENT_NOTIFY_EMAIL || SUPPORT_EMAIL;
const DEFAULT_SITE_BASE = 'https://arcade.earth';
const SIGNUP_CONFIRMATION_EXPIRY_MS = 48 * 60 * 60 * 1000;
const SIGNUP_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SIGNUP_FAILED_SEND_COOLDOWN_MS = 5 * 60 * 1000;
const SIGNUP_IP_ATTEMPTS_PER_HOUR = 3;
const SIGNUP_DAILY_EMAIL_BUDGET = 40;
const RECAPTCHA_ACTION = 'launch_signup';
const RECAPTCHA_PRODUCTION_SITE_KEY = '6LdHM4EtAAAAADWLkT76WYi26ZEMWr5Olii4JrSp';
const RECAPTCHA_DEVELOPMENT_SITE_KEY = '6LeV7IAtAAAAACep1SwP0qAB5l9qKEJMNOlyNUPb';
const RECAPTCHA_SITE_KEY_BY_HOSTNAME = new Map([
  ['arcade.earth', RECAPTCHA_PRODUCTION_SITE_KEY],
  ['www.arcade.earth', RECAPTCHA_PRODUCTION_SITE_KEY],
  ['aesite-30f9e.web.app', RECAPTCHA_PRODUCTION_SITE_KEY],
  ['dev.arcade.earth', RECAPTCHA_DEVELOPMENT_SITE_KEY],
  ['aesite-dev.web.app', RECAPTCHA_DEVELOPMENT_SITE_KEY],
  ['localhost', RECAPTCHA_DEVELOPMENT_SITE_KEY],
  ['127.0.0.1', RECAPTCHA_DEVELOPMENT_SITE_KEY],
]);
const ALLOWED_SITE_BASE_HOSTS = new Set([
  'arcade.earth',
  'www.arcade.earth',
  'dev.arcade.earth',
  'aesite-30f9e.web.app',
  'aesite-dev.web.app',
  'localhost:5173',
  '127.0.0.1:5173',
]);

const PRODUCT_CONFIG = {
  'comic-digital': {
    name: 'Digital Edition',
    productId: process.env.STRIPE_COMIC_DIGITAL_PRODUCT_ID || 'prod_Utiohi44L9R3OW',
    priceId: process.env.STRIPE_COMIC_DIGITAL_PRICE_ID || 'price_1TtvMUE6KbLJmYKbvXLGiUFD',
    entitlements: ['comic-pdf-v1'],
    fulfillmentType: 'digital',
  },
  'comic-motion': {
    name: 'Motion Video Comic',
    productId: process.env.STRIPE_COMIC_MOTION_PRODUCT_ID || 'prod_UtipfqhE0j4OHP',
    priceId: process.env.STRIPE_COMIC_MOTION_PRICE_ID || 'price_1TtvNzE6KbLJmYKbVET9MoGk',
    entitlements: ['comic-motion-stream-v1', 'comic-motion-download-v1'],
    fulfillmentType: 'digital',
  },
  'comic-physical': {
    name: 'Physical Edition',
    productId: process.env.STRIPE_COMIC_PHYSICAL_PRODUCT_ID || 'prod_UtivbVKP3daOLI',
    priceId: process.env.STRIPE_COMIC_PHYSICAL_PRICE_ID || 'price_1TtvTME6KbLJmYKb7FEAaeoQ',
    entitlements: [],
    fulfillmentType: 'physical',
    requiresShipping: true,
  },
  'comic-ultimate-bundle': {
    name: 'Ultimate Bundle',
    productId: process.env.STRIPE_COMIC_ULTIMATE_PRODUCT_ID || 'prod_Utj3C28MrpeyoU',
    priceId: process.env.STRIPE_COMIC_ULTIMATE_PRICE_ID || 'price_1TtvazE6KbLJmYKbZXABu2g0',
    entitlements: ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1', 'comic-bonus-marker-v1'],
    fulfillmentType: 'bundle',
    requiresShipping: true,
  },
};

const ASSET_CONFIG = {
  'comic-pdf-v1': {
    objectPath: () => process.env.COMIC_PDF_OBJECT_PATH,
    filename: 'Arcade-Earth-Rise-of-Vector.pdf',
    allowedActions: ['read', 'download'],
  },
  'comic-motion-stream-v1': {
    objectPath: () => process.env.COMIC_MOTION_VIDEO_OBJECT_PATH,
    filename: 'Arcade-Earth-Rise-of-Vector-Motion-Comic.mp4',
    allowedActions: ['stream'],
  },
  'comic-motion-download-v1': {
    objectPath: () => process.env.COMIC_MOTION_VIDEO_OBJECT_PATH,
    filename: 'Arcade-Earth-Rise-of-Vector-Motion-Comic.mp4',
    allowedActions: ['download'],
  },
};

function getStripe() {
  const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.value() || '').trim();
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
}

function sendJson(res, status, payload) {
  res
    .status(status)
    .set('Access-Control-Allow-Origin', '*')
    .set('Cache-Control', 'no-store')
    .json(payload);
}

function allowPost(req, res) {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
    res.status(204).send('');
    return false;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return false;
  }
  return true;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeSiteBase(value) {
  try {
    const url = new URL(String(value || ''));
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if ((!isLocal && url.protocol !== 'https:') || (isLocal && url.protocol !== 'http:')) {
      return null;
    }
    if (!ALLOWED_SITE_BASE_HOSTS.has(url.host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function resolveRequestSiteBase(req) {
  const explicitBase = normalizeSiteBase(req.body?.siteBase);
  if (explicitBase) return explicitBase;

  const originBase = normalizeSiteBase(req.get('origin'));
  if (originBase) return originBase;

  const referer = req.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererBase = normalizeSiteBase(refererUrl.origin);
      if (refererBase) return refererBase;
    } catch {
      // Ignore malformed referrers and use the configured fallback.
    }
  }

  return process.env.COMIC_SUCCESS_URL_BASE || DEFAULT_SITE_BASE;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class SignupRequestError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function resolveSignupSiteBase(req) {
  const origin = normalizeSiteBase(req.get('origin'));
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return normalizeSiteBase(new URL(referer).origin);
  } catch {
    return null;
  }
}

function sendSignupJson(req, res, status, payload) {
  const siteBase = resolveSignupSiteBase(req);
  if (siteBase) {
    res.set('Access-Control-Allow-Origin', siteBase);
    res.set('Vary', 'Origin');
  }
  res.status(status).set('Cache-Control', 'no-store').json(payload);
}

function allowSignupPost(req, res) {
  const siteBase = resolveSignupSiteBase(req);
  if (!siteBase) {
    res.status(403).set('Cache-Control', 'no-store').json({ error: 'Request origin is not allowed.' });
    return null;
  }
  if (req.method === 'OPTIONS') {
    res
      .set('Access-Control-Allow-Origin', siteBase)
      .set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .set('Access-Control-Allow-Headers', 'Content-Type')
      .set('Access-Control-Max-Age', '3600')
      .set('Vary', 'Origin')
      .status(204)
      .send('');
    return null;
  }
  if (req.method !== 'POST') {
    sendSignupJson(req, res, 405, { error: 'Method not allowed.' });
    return null;
  }
  return siteBase;
}

async function verifyRecaptcha({ token, siteKey, expectedHostname }) {
  const expectedSiteKey = RECAPTCHA_SITE_KEY_BY_HOSTNAME.get(expectedHostname);
  if (!expectedSiteKey || siteKey !== expectedSiteKey) {
    throw new SignupRequestError(400, 'Please complete the verification and try again.', 'recaptcha_site_key_mismatch');
  }
  if (typeof token !== 'string' || !token || token.length > 8192) {
    throw new SignupRequestError(400, 'Please complete the verification and try again.', 'recaptcha_token_missing');
  }

  let assessment;
  try {
    const auth = await recaptchaAuth.getClient();
    const response = await recaptchaClient.projects.assessments.create({
      parent: `projects/${googleCloudProject}`,
      requestBody: {
        event: {
          token,
          siteKey,
          expectedAction: RECAPTCHA_ACTION,
        },
      },
      auth,
    });
    assessment = response.data;
  } catch (error) {
    functions.logger.error('reCAPTCHA assessment request failed.', { error: error?.message || error });
    throw new SignupRequestError(503, 'Verification is temporarily unavailable.', 'recaptcha_unavailable');
  }

  const tokenProperties = assessment?.tokenProperties || {};
  const score = Number(assessment?.riskAnalysis?.score ?? 0);
  const valid = tokenProperties.valid === true &&
    tokenProperties.action === RECAPTCHA_ACTION &&
    tokenProperties.hostname === expectedHostname &&
    score >= 0.5;
  if (!valid) {
    functions.logger.warn('reCAPTCHA rejected launch signup.', {
      hostname: tokenProperties.hostname || null,
      action: tokenProperties.action || null,
      invalidReason: tokenProperties.invalidReason || null,
      score,
      reasons: assessment?.riskAnalysis?.reasons || [],
    });
    throw new SignupRequestError(400, 'Please complete the verification and try again.', 'recaptcha_rejected');
  }
}

function timestampMillis(value) {
  return value?.toMillis?.() || 0;
}

function getResend() {
  const apiKey = String(process.env.RESEND_API_KEY || RESEND_API_KEY.value() || '').trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(amount, currency = 'usd') {
  if (typeof amount !== 'number') return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format(amount / 100);
}

function buildLibraryUrl(token, siteBase = null) {
  const baseUrl = normalizeSiteBase(siteBase) || process.env.ARCADE_EARTH_LIBRARY_URL_BASE || DEFAULT_SITE_BASE;
  return `${baseUrl.replace(/\/$/, '')}/library/session?t=${encodeURIComponent(token)}`;
}

async function sendTransactionalEmail({ to, subject, html, text = null, tag = 'transactional' }) {
  const resend = getResend();
  if (!resend) {
    functions.logger.info('Resend key not configured; skipping email.', { to, subject, tag });
    return { skipped: true };
  }

  return resend.emails.send({
    from: RESEND_FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    tags: [{ name: 'type', value: tag }],
  });
}

function createRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenExpiryDate() {
  return new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

async function createLibraryToken({ email, orderId = null, entitlementId = null }) {
  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = Timestamp.fromDate(tokenExpiryDate());

  await db.collection('comicAccessTokens').doc(tokenHash).set({
    email: normalizeEmail(email),
    orderId,
    entitlementId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    downloadCount: 0,
    revoked: false,
  });

  return { token, tokenHash, expiresAt };
}

async function verifyLibraryToken(token) {
  if (!token) {
    throw new Error('Library session required.');
  }

  const snap = await db.collection('comicAccessTokens').doc(hashToken(token)).get();
  if (!snap.exists) {
    throw new Error('Library link is invalid or expired.');
  }

  const data = snap.data();
  const expiresAt = data.expiresAt?.toDate?.() || null;
  if (data.revoked || !expiresAt || expiresAt.getTime() < Date.now()) {
    throw new Error('Library link is invalid or expired.');
  }

  return { tokenHash: snap.id, ...data };
}

function renderEmailShell({ title, intro, body }) {
  return `
    <div style="margin:0; padding:0; background:#020203;">
      <div style="max-width:640px; margin:0 auto; padding:28px; font-family:Inter, Arial, sans-serif; color:#f7f7f2;">
        <p style="margin:0 0 18px; color:#9effff; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Arcade Earth</p>
        <h1 style="margin:0 0 16px; font-size:28px; line-height:1.15;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px; color:#d7d7cf; font-size:16px; line-height:1.6;">${escapeHtml(intro)}</p>
        ${body}
        <hr style="border:0; border-top:1px solid rgba(247,247,242,0.16); margin:28px 0;">
        <p style="margin:0; color:#a8a89f; font-size:13px; line-height:1.6;">Need help? Reply to this email or contact <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#9effff;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>
      </div>
    </div>
  `;
}

function renderCta(href, label) {
  return `
    <p style="margin:26px 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block; padding:13px 18px; color:#020203; background:#f7f7f2; text-decoration:none; font-weight:800;">${escapeHtml(label)}</a>
    </p>
  `;
}

function renderLaunchConfirmationEmail(confirmUrl) {
  return renderEmailShell({
    title: 'Confirm your Arcade Earth updates',
    intro: 'One quick check keeps the launch list useful and protects your inbox.',
    body: `
      <p style="margin:0 0 18px; color:#d7d7cf; font-size:15px; line-height:1.6;">
        Confirm that you want updates about Rise of Vector, Thumb War, and future Planetary Games releases.
      </p>
      ${renderCta(confirmUrl, 'Confirm My Email')}
      <p style="margin:0; color:#a8a89f; font-size:13px; line-height:1.6;">
        This link expires in 48 hours. If you did not request it, you can ignore this message.
      </p>
    `,
  });
}

function renderSignupConfirmationPage({ confirmed }) {
  const title = confirmed ? 'You’re on the launch list.' : 'This confirmation link is invalid or expired.';
  const message = confirmed
    ? 'Thanks for confirming. We’ll only send the important Arcade Earth updates.'
    : 'Return to Arcade Earth and submit the form again to request a fresh link.';
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>${escapeHtml(title)} · Arcade Earth</title>
        <style>
          :root { color-scheme: dark; }
          body { margin:0; min-height:100vh; display:grid; place-items:center; background:#020203; color:#f7f7f2; font-family:Inter,Arial,sans-serif; }
          main { width:min(620px,calc(100% - 40px)); padding:40px; border:1px solid rgba(247,247,242,.18); background:#0b0b0e; }
          p:first-child { color:#9effff; font-size:12px; letter-spacing:.08em; text-transform:uppercase; }
          h1 { font-size:clamp(28px,6vw,48px); line-height:1.05; margin:18px 0; }
          p { color:#d7d7cf; line-height:1.6; }
          a { display:inline-block; margin-top:18px; padding:13px 18px; background:#f7f7f2; color:#020203; font-weight:800; text-decoration:none; }
        </style>
      </head>
      <body><main><p>Arcade Earth</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/">Return to Arcade Earth</a></main></body>
    </html>`;
}

function renderOrderSummary({ orderId, editionName, total }) {
  return `
    <div style="padding:16px; border:1px solid rgba(247,247,242,0.18); margin:0 0 22px;">
      <p style="margin:0 0 8px; color:#a8a89f; font-size:13px;">Order</p>
      <p style="margin:0; font-size:16px; line-height:1.6;"><strong>${escapeHtml(editionName)}</strong></p>
      <p style="margin:6px 0 0; color:#d7d7cf; font-size:14px;">${escapeHtml(orderId)}${total ? ` - ${escapeHtml(total)}` : ''}</p>
    </div>
  `;
}

function renderShippingAddress(shipping) {
  const address = shipping?.address || {};
  const lines = [
    shipping?.name,
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);

  if (!lines.length) return '';

  return `
    <p style="margin:12px 0 0; color:#d7d7cf; font-size:14px; line-height:1.6;">
      ${lines.map((line) => escapeHtml(line)).join('<br>')}
    </p>
  `;
}

function renderPurchaseConfirmationEmail({ orderId, productConfig, amountTotal, currency, shipping, libraryUrl }) {
  const hasLibraryAccess = Boolean(libraryUrl);
  const hasPdf = productConfig.entitlements.includes('comic-pdf-v1');
  const hasMotion = productConfig.entitlements.includes('comic-motion-stream-v1');
  const hasPhysical = Boolean(productConfig.requiresShipping);
  const total = formatMoney(amountTotal, currency);

  const sections = [
    renderOrderSummary({ orderId, editionName: productConfig.name, total }),
  ];

  if (hasLibraryAccess) {
    sections.push(`
      <div style="margin:0 0 22px;">
        <h2 style="margin:0 0 8px; font-size:18px;">Your Library access</h2>
        <p style="margin:0; color:#d7d7cf; font-size:15px; line-height:1.6;">
          Open your secure Arcade Earth Library to ${hasPdf ? 'read' : ''}${hasPdf && hasMotion ? ', ' : ''}${hasMotion ? 'watch' : ''}${hasPdf || hasMotion ? ', and download your purchased media' : 'access your purchased media'}.
        </p>
        ${renderCta(libraryUrl, 'Open My Library')}
        <p style="margin:0; color:#a8a89f; font-size:13px; line-height:1.6;">This secure Library link expires in ${TOKEN_EXPIRY_DAYS} days. You can request a fresh link later using the same checkout email.</p>
      </div>
    `);
  }

  if (hasPhysical) {
    sections.push(`
      <div style="margin:0 0 22px;">
        <h2 style="margin:0 0 8px; font-size:18px;">Physical edition shipping</h2>
        <p style="margin:0; color:#d7d7cf; font-size:15px; line-height:1.6;">
          We received your physical order. Standard shipping is handled manually and usually arrives in 5-10 business days after fulfillment.
        </p>
        ${renderShippingAddress(shipping)}
      </div>
    `);
  }

  return renderEmailShell({
    title: 'Your Arcade Earth order is confirmed.',
    intro: 'Thanks for supporting Rise of Vector. Your purchase details are below.',
    body: sections.join(''),
  });
}

function renderLibraryAccessEmail(libraryUrl) {
  return renderEmailShell({
    title: 'Your Arcade Earth Library link is ready.',
    intro: 'Use this secure link to open the Arcade Earth Library tied to your checkout email.',
    body: `
      ${renderCta(libraryUrl, 'Open My Library')}
      <p style="margin:0; color:#a8a89f; font-size:13px; line-height:1.6;">This secure Library link expires in ${TOKEN_EXPIRY_DAYS} days. You can request a new one from Arcade Earth later.</p>
    `,
  });
}

function renderFulfillmentEmail({ session, productConfig }) {
  const total = formatMoney(session.amount_total, session.currency);
  const shipping = session.shipping_details || {};
  return renderEmailShell({
    title: 'Physical fulfillment needed.',
    intro: `${productConfig.name} was purchased and needs manual fulfillment.`,
    body: `
      ${renderOrderSummary({ orderId: session.id, editionName: productConfig.name, total })}
      <div style="margin:0 0 22px;">
        <h2 style="margin:0 0 8px; font-size:18px;">Ship to</h2>
        ${renderShippingAddress(shipping) || '<p style="margin:0; color:#ff8fa3;">No shipping address found on the Stripe session.</p>'}
      </div>
      <p style="margin:0; color:#d7d7cf; font-size:14px; line-height:1.6;">Customer: ${escapeHtml(normalizeEmail(session.customer_details?.email || session.customer_email))}</p>
      <p style="margin:8px 0 0; color:#d7d7cf; font-size:14px; line-height:1.6;">Stripe session: ${escapeHtml(session.id)}</p>
    `,
  });
}

function renderShippingNotificationEmail({ orderId, productConfig, fulfillment }) {
  const trackingUrl = fulfillment?.trackingUrl;
  const trackingNumber = fulfillment?.trackingNumber;
  const carrier = fulfillment?.carrier;

  return renderEmailShell({
    title: 'Your Arcade Earth order has shipped.',
    intro: `${productConfig?.name || 'Your physical edition'} is on the way.`,
    body: `
      ${renderOrderSummary({ orderId, editionName: productConfig?.name || 'Arcade Earth physical edition', total: null })}
      <div style="margin:0 0 22px;">
        <h2 style="margin:0 0 8px; font-size:18px;">Tracking</h2>
        <p style="margin:0; color:#d7d7cf; font-size:15px; line-height:1.6;">
          ${carrier ? `Carrier: ${escapeHtml(carrier)}<br>` : ''}
          ${trackingNumber ? `Tracking number: ${escapeHtml(trackingNumber)}` : 'Tracking details were added to your order.'}
        </p>
        ${trackingUrl ? renderCta(trackingUrl, 'Track Shipment') : ''}
      </div>
    `,
  });
}

function renderRefundRevocationEmail({ orderId, productConfig, reason }) {
  return renderEmailShell({
    title: 'Your Arcade Earth order status changed.',
    intro: `Your ${productConfig?.name || 'Arcade Earth'} order is now marked ${reason}.`,
    body: `
      ${renderOrderSummary({ orderId, editionName: productConfig?.name || 'Arcade Earth order', total: null })}
      <p style="margin:0; color:#d7d7cf; font-size:15px; line-height:1.6;">
        Any related Library access has been updated to match this order status. If this looks wrong, contact support and include your order ID.
      </p>
    `,
  });
}

async function sendLibraryAccessEmail(email, token, siteBase = null) {
  const libraryUrl = buildLibraryUrl(token, siteBase);
  await sendTransactionalEmail({
    to: email,
    subject: 'Your Arcade Earth Library link',
    html: renderLibraryAccessEmail(libraryUrl),
    tag: 'library-access',
  });
}

async function sendPurchaseConfirmationEmail({ email, session, productConfig, token = null, siteBase = null }) {
  const libraryUrl = token ? buildLibraryUrl(token, siteBase) : null;
  await sendTransactionalEmail({
    to: email,
    subject: 'Your Arcade Earth order is confirmed',
    html: renderPurchaseConfirmationEmail({
      orderId: session.id,
      productConfig,
      amountTotal: session.amount_total,
      currency: session.currency,
      shipping: session.shipping_details,
      libraryUrl,
    }),
    tag: 'purchase-confirmation',
  });
}

async function sendInternalFulfillmentEmail({ session, productConfig }) {
  await sendTransactionalEmail({
    to: FULFILLMENT_NOTIFY_EMAIL,
    subject: `Fulfill Arcade Earth order ${session.id}`,
    html: renderFulfillmentEmail({ session, productConfig }),
    tag: 'fulfillment',
  });
}

async function sendShippingNotificationEmail({ email, orderId, productConfig, fulfillment }) {
  await sendTransactionalEmail({
    to: email,
    subject: 'Your Arcade Earth order has shipped',
    html: renderShippingNotificationEmail({ orderId, productConfig, fulfillment }),
    tag: 'shipping',
  });
}

async function sendRefundRevocationEmail({ email, orderId, productConfig, reason }) {
  await sendTransactionalEmail({
    to: email,
    subject: 'Your Arcade Earth order status changed',
    html: renderRefundRevocationEmail({ orderId, productConfig, reason }),
    tag: 'refund-revocation',
  });
}

function getSuccessUrl(siteBase) {
  const base = normalizeSiteBase(siteBase) || process.env.COMIC_SUCCESS_URL_BASE || DEFAULT_SITE_BASE;
  return `${base.replace(/\/$/, '')}/comic/success?session_id={CHECKOUT_SESSION_ID}`;
}

function getCancelUrl(siteBase) {
  const base = normalizeSiteBase(siteBase) || process.env.COMIC_CANCEL_URL_BASE || DEFAULT_SITE_BASE;
  return `${base.replace(/\/$/, '')}/comic?checkout=cancelled`;
}

function publicOrderItem(session, sku, config) {
  return {
    sku,
    quantity: 1,
    priceId: config.priceId,
    productId: config.productId,
    amountSubtotal: session.amount_subtotal ?? null,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? 'usd',
    fulfillmentType: config.fulfillmentType,
  };
}

async function writeOrderAndEntitlements(session, eventId = null) {
  const sku = session.metadata?.sku;
  const config = PRODUCT_CONFIG[sku];
  if (!config) {
    functions.logger.warn('Checkout session missing known SKU.', { sessionId: session.id, sku });
    return;
  }

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) {
    functions.logger.warn('Checkout session missing customer email.', { sessionId: session.id });
    return;
  }

  const orderRef = db.collection('comicOrders').doc(session.id);
  const entitlementRef = db.collection('comicEntitlements').doc(`${session.id}_${sku}`);
  const shippingDetails = session.shipping_details || null;
  let orderAlreadyPaid = false;

  await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (orderSnap.exists && orderSnap.data()?.status === 'paid') {
      orderAlreadyPaid = true;
      return;
    }

    transaction.set(orderRef, {
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      stripeEventId: eventId,
      email,
      status: 'paid',
      items: [publicOrderItem(session, sku, config)],
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? 'usd',
      shipping: shippingDetails,
      fulfillment: {
        status: config.requiresShipping ? 'processing' : 'digital',
        carrier: null,
        trackingNumber: null,
        shippedAt: null,
      },
      createdAt: Timestamp.fromMillis((session.created || Math.floor(Date.now() / 1000)) * 1000),
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(entitlementRef, {
      orderId: session.id,
      email,
      sku,
      edition: config.name,
      assetIds: config.entitlements,
      fulfillmentType: config.fulfillmentType,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      lastAccessedAt: null,
      downloadCount: 0,
      maxDownloadCount: null,
    }, { merge: true });
  });

  if (orderAlreadyPaid) {
    return;
  }

  let token = null;
  if (config.entitlements.length > 0) {
    const tokenResult = await createLibraryToken({ email, orderId: session.id, entitlementId: entitlementRef.id });
    token = tokenResult.token;
  }

  const emailStatus = {};

  try {
    await sendPurchaseConfirmationEmail({
      email,
      session,
      productConfig: config,
      token,
      siteBase: session.metadata?.siteBase,
    });
    emailStatus.purchaseConfirmationSentAt = FieldValue.serverTimestamp();
  } catch (error) {
    functions.logger.error('Failed to send purchase confirmation email.', {
      email,
      sessionId: session.id,
      error: error?.response?.body || error?.message || error,
    });
    emailStatus.purchaseConfirmationError = error?.message || String(error);
  }

  if (config.requiresShipping) {
    try {
      await sendInternalFulfillmentEmail({ session, productConfig: config });
      emailStatus.fulfillmentNotificationSentAt = FieldValue.serverTimestamp();
    } catch (error) {
      functions.logger.error('Failed to send internal fulfillment email.', {
        sessionId: session.id,
        error: error?.response?.body || error?.message || error,
      });
      emailStatus.fulfillmentNotificationError = error?.message || String(error);
    }
  }

  if (Object.keys(emailStatus).length) {
    await orderRef.set({
      emailStatus,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

export const createComicCheckoutSession = onRequest({ invoker: 'public', secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (!allowPost(req, res)) return;

  try {
    const { sku, quantity = 1 } = req.body || {};
    const config = PRODUCT_CONFIG[sku];
    const count = Number(quantity);

    if (!config || !Number.isInteger(count) || count !== 1) {
      sendJson(res, 400, { error: 'Choose a valid Arcade Earth edition.' });
      return;
    }

    const siteBase = resolveRequestSiteBase(req);
    const checkoutConfig = {
      mode: 'payment',
      line_items: [{ price: config.priceId, quantity: count }],
      customer_creation: 'always',
      success_url: getSuccessUrl(siteBase),
      cancel_url: getCancelUrl(siteBase),
      automatic_tax: { enabled: true },
      metadata: {
        sku,
        siteBase,
        productFamily: 'comic',
        entitlementSet: config.entitlements.join(','),
      },
    };

    if (config.requiresShipping) {
      checkoutConfig.shipping_address_collection = {
        allowed_countries: (process.env.COMIC_ALLOWED_SHIPPING_COUNTRIES || 'US').split(',').map((country) => country.trim()).filter(Boolean),
      };
      checkoutConfig.shipping_options = [{
        shipping_rate: process.env.STRIPE_COMIC_SHIPPING_RATE_ID || 'shr_1TtwPpE6KbLJmYKbqxRpYnQj',
      }];
    }

    const session = await getStripe().checkout.sessions.create(checkoutConfig);
    sendJson(res, 200, { url: session.url });
  } catch (error) {
    functions.logger.error('Failed to create comic checkout session.', {
      type: error?.type || null,
      code: error?.code || null,
      message: error?.message || String(error),
    });
    sendJson(res, 500, { error: 'Checkout is unavailable right now.' });
  }
});

export const stripeComicWebhook = onRequest({ invoker: 'public', secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const signature = req.get('stripe-signature');
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET.value() || '').trim();
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }

    const event = getStripe().webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    const eventRef = db.collection('stripeWebhookEvents').doc(event.id);
    const eventSnap = await eventRef.get();
    if (eventSnap.exists) {
      await eventRef.set({ duplicateCount: FieldValue.increment(1) }, { merge: true });
      res.status(200).send('duplicate');
      return;
    }

    await eventRef.set({
      type: event.type,
      processedAt: FieldValue.serverTimestamp(),
      stripeSessionId: event.data?.object?.id || null,
    });

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = await getStripe().checkout.sessions.retrieve(event.data.object.id, {
        expand: ['customer', 'customer_details', 'payment_intent'],
      });
      await writeOrderAndEntitlements(session, event.id);
    }

    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const paymentIntentId = typeof event.data.object.payment_intent === 'string'
        ? event.data.object.payment_intent
        : event.data.object.payment_intent?.id;
      if (paymentIntentId) {
        const orders = await db.collection('comicOrders').where('stripePaymentIntentId', '==', paymentIntentId).get();
        await Promise.all(orders.docs.map(async (orderDoc) => {
          const orderData = orderDoc.data();
          const sku = orderData.items?.[0]?.sku;
          const config = PRODUCT_CONFIG[sku];
          const reason = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
          await orderDoc.ref.set({
            status: reason,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          const entitlements = await db.collection('comicEntitlements').where('orderId', '==', orderDoc.id).get();
          await Promise.all(entitlements.docs.map((entitlement) => entitlement.ref.set({
            status: event.type === 'charge.refunded' ? 'refunded' : 'revoked',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true })));
          if (orderData.email) {
            try {
              await sendRefundRevocationEmail({
                email: orderData.email,
                orderId: orderDoc.id,
                productConfig: config,
                reason,
              });
              await orderDoc.ref.set({
                emailStatus: {
                  refundRevocationSentAt: FieldValue.serverTimestamp(),
                },
              }, { merge: true });
            } catch (error) {
              functions.logger.error('Failed to send refund/revocation email.', {
                orderId: orderDoc.id,
                error: error?.response?.body || error?.message || error,
              });
              await orderDoc.ref.set({
                emailStatus: {
                  refundRevocationError: error?.message || String(error),
                },
              }, { merge: true });
            }
          }
        }));
      }
    }

    res.status(200).send('ok');
  } catch (error) {
    functions.logger.error('Stripe comic webhook failed.', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export const resendComicAccess = onRequest({ invoker: 'public', secrets: [RESEND_API_KEY] }, async (req, res) => {
  if (!allowPost(req, res)) return;

  const email = normalizeEmail(req.body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(res, 400, { error: 'Enter a valid email address.' });
    return;
  }

  try {
    const entitlements = await db.collection('comicEntitlements')
      .where('email', '==', email)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!entitlements.empty) {
      const entitlement = entitlements.docs[0];
      const { token } = await createLibraryToken({
        email,
        orderId: entitlement.data().orderId,
        entitlementId: entitlement.id,
      });
      await sendLibraryAccessEmail(email, token, resolveRequestSiteBase(req));
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    functions.logger.error('Failed to resend comic access.', error);
    sendJson(res, 500, { error: 'Library access email could not be sent right now.' });
  }
});

export const verifyLibrarySession = onRequest({ invoker: 'public' }, async (req, res) => {
  if (!allowPost(req, res)) return;

  try {
    const token = req.body?.token;
    const verified = await verifyLibraryToken(token);
    await db.collection('comicAccessTokens').doc(verified.tokenHash).set({
      usedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    sendJson(res, 200, { token, email: verified.email, expiresAt: verified.expiresAt?.toDate?.()?.toISOString?.() || null });
  } catch (error) {
    sendJson(res, 401, { error: error.message || 'Library link is invalid or expired.' });
  }
});

export const getLibrary = onRequest({ invoker: 'public' }, async (req, res) => {
  if (!allowPost(req, res)) return;

  try {
    const verified = await verifyLibraryToken(req.body?.token);
    const entitlements = await db.collection('comicEntitlements')
      .where('email', '==', verified.email)
      .where('status', '==', 'active')
      .get();

    const items = entitlements.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        orderId: data.orderId,
        sku: data.sku,
        edition: data.edition,
        assetIds: data.assetIds || [],
        fulfillmentType: data.fulfillmentType,
        purchaseDate: data.createdAt?.toDate?.()?.toLocaleDateString?.('en-US') || null,
      };
    });

    sendJson(res, 200, { email: verified.email, items });
  } catch (error) {
    sendJson(res, 401, { error: error.message || 'Library session expired.' });
  }
});

export const createAssetAccess = onRequest({ invoker: 'public' }, async (req, res) => {
  if (!allowPost(req, res)) return;

  try {
    const verified = await verifyLibraryToken(req.body?.token);
    const action = String(req.body?.action || '');
    const assetId = String(req.body?.assetId || '');
    const asset = ASSET_CONFIG[assetId];
    if (!asset || !['read', 'stream', 'download'].includes(action)) {
      sendJson(res, 400, { error: 'Choose a valid Library action.' });
      return;
    }
    if (!asset.allowedActions.includes(action)) {
      sendJson(res, 400, { error: 'That media action is not available for this asset.' });
      return;
    }

    const entitlements = await db.collection('comicEntitlements')
      .where('email', '==', verified.email)
      .where('status', '==', 'active')
      .get();
    const entitlement = entitlements.docs.find((docSnap) => docSnap.data().assetIds?.includes(assetId));
    if (!entitlement) {
      sendJson(res, 403, { error: 'This Library does not include that media.' });
      return;
    }

    const objectPath = asset.objectPath();
    const bucketName = process.env.COMIC_ASSET_BUCKET;
    if (!bucketName || !objectPath) {
      sendJson(res, 503, { error: 'Comic media storage is not configured yet.' });
      return;
    }

    const file = admin.storage().bucket(bucketName).file(objectPath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + SIGNED_URL_EXPIRY_MS,
      responseDisposition: action === 'download'
        ? `attachment; filename="${asset.filename}"`
        : `inline; filename="${asset.filename}"`,
    });

    await Promise.all([
      entitlement.ref.set({
        lastAccessedAt: FieldValue.serverTimestamp(),
        downloadCount: action === 'download' ? FieldValue.increment(1) : FieldValue.increment(0),
      }, { merge: true }),
      db.collection('comicAssetAccessLogs').add({
        email: verified.email,
        entitlementId: entitlement.id,
        assetId,
        action,
        tokenHash: verified.tokenHash,
        createdAt: FieldValue.serverTimestamp(),
        userAgent: req.get('user-agent') || null,
        ip: req.ip || null,
      }),
    ]);

    sendJson(res, 200, {
      url,
      expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_MS).toISOString(),
    });
  } catch (error) {
    functions.logger.error('Failed to create asset access.', error);
    sendJson(res, 401, { error: error.message || 'Media access unavailable.' });
  }
});

export const sendShippingUpdateEmail = onDocumentUpdated({
  document: 'comicOrders/{orderId}',
  secrets: [RESEND_API_KEY],
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after?.email) return;

  const beforeFulfillment = before.fulfillment || {};
  const afterFulfillment = after.fulfillment || {};
  const trackingAdded = afterFulfillment.trackingNumber &&
    afterFulfillment.trackingNumber !== beforeFulfillment.trackingNumber;
  const markedShipped = ['shipped', 'fulfilled'].includes(afterFulfillment.status) &&
    afterFulfillment.status !== beforeFulfillment.status;
  const alreadySent = Boolean(after.emailStatus?.shippingNotificationSentAt);

  if ((!trackingAdded && !markedShipped) || alreadySent) {
    return;
  }

  const sku = after.items?.[0]?.sku;
  const productConfig = PRODUCT_CONFIG[sku];
  if (!productConfig?.requiresShipping) {
    return;
  }

  try {
    await sendShippingNotificationEmail({
      email: after.email,
      orderId: event.params.orderId,
      productConfig,
      fulfillment: afterFulfillment,
    });
    await event.data.after.ref.set({
      emailStatus: {
        shippingNotificationSentAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    functions.logger.error('Failed to send shipping notification email.', {
      orderId: event.params.orderId,
      error: error?.response?.body || error?.message || error,
    });
    await event.data.after.ref.set({
      emailStatus: {
        shippingNotificationError: error?.message || String(error),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
});

export const submitLaunchSignup = onRequest({
  invoker: 'public',
  secrets: [RESEND_API_KEY, SIGNUP_IP_HASH_SECRET],
}, async (req, res) => {
  const siteBase = allowSignupPost(req, res);
  if (!siteBase) return;

  const genericSuccess = {
    ok: true,
    message: 'If this address is eligible, a confirmation link is on its way.',
  };

  try {
    // Honeypot and timing checks are intentionally answered like valid requests.
    // This gives basic bots no feedback about which defense caught them.
    if (String(req.body?.website || '').trim() || isSuspiciousSignupTiming(req.body?.startedAt)) {
      functions.logger.info('Silently discarded automated launch signup signal.');
      sendSignupJson(req, res, 202, genericSuccess);
      return;
    }

    const email = normalizeSignupEmail(req.body?.email);
    if (!isValidSignupEmail(email)) {
      throw new SignupRequestError(400, 'Please enter a valid email address.', 'invalid_email');
    }

    const ip = getClientIp(req);
    const expectedHostname = new URL(siteBase).hostname;
    await verifyRecaptcha({
      token: req.body?.recaptchaToken,
      siteKey: req.body?.recaptchaSiteKey,
      expectedHostname,
    });

    const ipSecret = String(process.env.SIGNUP_IP_HASH_SECRET || SIGNUP_IP_HASH_SECRET.value() || '').trim();
    if (!ipSecret) {
      throw new SignupRequestError(503, 'Email signup is temporarily unavailable.', 'ip_hash_not_configured');
    }

    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    const emailHash = hashSignupEmail(email);
    const ipHash = hashSignupIp(ip, ipSecret);
    const rateIds = buildSignupRateLimitIds({ emailHash, ipHash, now });
    const attribution = sanitizeSignupAttribution(req.body?.attribution);
    const rawToken = buildConfirmationToken(emailHash);
    const confirmationTokenHash = hashSignupEmail(rawToken);
    const pendingRef = db.collection('pendingLaunchSignups').doc(emailHash);
    const confirmedRef = db.collection('launchSignups').doc(emailHash);
    const ipLimitRef = db.collection('signupRateLimits').doc(rateIds.ip);
    const emailLimitRef = db.collection('signupRateLimits').doc(rateIds.email);
    const dailyLimitRef = db.collection('signupRateLimits').doc(rateIds.daily);

    // Preserve compatibility with the two pre-hardening records whose document
    // IDs were email addresses rather than hashes.
    const existingByEmail = await db.collection('launchSignups').where('email', '==', email).limit(1).get();
    if (!existingByEmail.empty) {
      sendSignupJson(req, res, 202, genericSuccess);
      return;
    }

    const reservation = await db.runTransaction(async (transaction) => {
      const [confirmedSnap, ipLimitSnap, emailLimitSnap, dailyLimitSnap] = await transaction.getAll(
        confirmedRef,
        ipLimitRef,
        emailLimitRef,
        dailyLimitRef
      );

      if (confirmedSnap.exists) return { shouldSend: false, reason: 'already_confirmed' };

      const ipLimit = ipLimitSnap.data() || {};
      const ipCount = timestampMillis(ipLimit.expiresAt) > now.getTime() ? Number(ipLimit.count || 0) : 0;
      if (ipCount >= SIGNUP_IP_ATTEMPTS_PER_HOUR) {
        throw new SignupRequestError(429, 'Too many signup attempts. Please try again later.', 'ip_rate_limit');
      }

      const emailLimit = emailLimitSnap.data() || {};
      if (timestampMillis(emailLimit.nextAllowedAt) > now.getTime()) {
        transaction.set(ipLimitRef, {
          kind: 'ip-hour',
          count: ipCount + 1,
          updatedAt: nowTimestamp,
          expiresAt: Timestamp.fromMillis(now.getTime() + 2 * 60 * 60 * 1000),
        });
        return { shouldSend: false, reason: 'email_cooldown' };
      }

      const dailyCount = Number(dailyLimitSnap.data()?.count || 0);
      if (dailyCount >= SIGNUP_DAILY_EMAIL_BUDGET) {
        throw new SignupRequestError(503, 'Email signup has reached today’s limit. Please try again tomorrow.', 'daily_budget');
      }

      transaction.set(ipLimitRef, {
        kind: 'ip-hour',
        count: ipCount + 1,
        updatedAt: nowTimestamp,
        expiresAt: Timestamp.fromMillis(now.getTime() + 2 * 60 * 60 * 1000),
      });
      transaction.set(emailLimitRef, {
        kind: 'email',
        updatedAt: nowTimestamp,
        nextAllowedAt: Timestamp.fromMillis(now.getTime() + SIGNUP_FAILED_SEND_COOLDOWN_MS),
        expiresAt: Timestamp.fromMillis(now.getTime() + SIGNUP_EMAIL_COOLDOWN_MS + 24 * 60 * 60 * 1000),
      });
      transaction.set(dailyLimitRef, {
        kind: 'daily-budget',
        count: dailyCount + 1,
        updatedAt: nowTimestamp,
        expiresAt: Timestamp.fromMillis(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
      transaction.set(pendingRef, {
        email,
        emailHash,
        confirmationTokenHash,
        requestedAt: nowTimestamp,
        expiresAt: Timestamp.fromMillis(now.getTime() + SIGNUP_CONFIRMATION_EXPIRY_MS),
        ipHash,
        status: 'reserved',
        consentVersion: 'launch-list-v1',
        ...attribution,
      });
      return { shouldSend: true };
    });

    if (!reservation.shouldSend) {
      sendSignupJson(req, res, 202, genericSuccess);
      return;
    }

    const confirmUrl = `${siteBase.replace(/\/$/, '')}/api/confirmLaunchSignup?token=${encodeURIComponent(rawToken)}`;
    try {
      const sendResult = await sendTransactionalEmail({
        to: email,
        subject: 'Confirm your Arcade Earth updates',
        html: renderLaunchConfirmationEmail(confirmUrl),
        text: `Confirm your Arcade Earth updates: ${confirmUrl}\n\nThis link expires in 48 hours.`,
        tag: 'launch-confirmation',
      });
      if (sendResult?.skipped || sendResult?.error) {
        throw new Error(sendResult?.error?.message || 'Resend is not configured.');
      }
      await Promise.all([
        pendingRef.set({ status: 'sent', lastConfirmationSentAt: FieldValue.serverTimestamp() }, { merge: true }),
        emailLimitRef.set({
          updatedAt: FieldValue.serverTimestamp(),
          nextAllowedAt: Timestamp.fromMillis(now.getTime() + SIGNUP_EMAIL_COOLDOWN_MS),
        }, { merge: true }),
      ]);
    } catch (error) {
      functions.logger.error('Failed to send launch confirmation email.', {
        emailHash,
        error: error?.response?.body || error?.message || error,
      });
      await pendingRef.set({ status: 'send_failed', sendFailedAt: FieldValue.serverTimestamp() }, { merge: true });
      throw new SignupRequestError(503, 'Email signup is temporarily unavailable. Please try again later.', 'email_send_failed');
    }

    sendSignupJson(req, res, 202, genericSuccess);
  } catch (error) {
    const status = error instanceof SignupRequestError ? error.status : 500;
    const message = error instanceof SignupRequestError ? error.message : 'Email signup is temporarily unavailable.';
    if (!(error instanceof SignupRequestError)) {
      functions.logger.error('Launch signup failed.', { error: error?.message || error });
    }
    sendSignupJson(req, res, status, { error: message });
  }
});

export const confirmLaunchSignup = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).set('Allow', 'GET').send('Method not allowed.');
    return;
  }

  const parsed = parseConfirmationToken(req.query?.token);
  if (!parsed) {
    res.status(400).type('html').send(renderSignupConfirmationPage({ confirmed: false }));
    return;
  }

  try {
    const confirmed = await db.runTransaction(async (transaction) => {
      const pendingRef = db.collection('pendingLaunchSignups').doc(parsed.emailHash);
      const launchRef = db.collection('launchSignups').doc(parsed.emailHash);
      const [pendingSnap, launchSnap] = await transaction.getAll(pendingRef, launchRef);
      if (launchSnap.exists || !pendingSnap.exists) return false;

      const pending = pendingSnap.data();
      const expired = timestampMillis(pending.expiresAt) <= Date.now();
      if (expired || pending.status !== 'sent' || !safeTokenHashMatches(parsed.token, pending.confirmationTokenHash)) {
        return false;
      }

      transaction.create(launchRef, {
        email: pending.email,
        submittedAt: pending.requestedAt || FieldValue.serverTimestamp(),
        confirmedAt: FieldValue.serverTimestamp(),
        locale: pending.locale || null,
        referrer: pending.referrer || null,
        sourceUrl: pending.sourceUrl || null,
        utm: pending.utm || null,
        deviceType: null,
        consentVersion: pending.consentVersion || 'launch-list-v1',
        status: 'subscribed',
      });
      transaction.delete(pendingRef);
      return true;
    });

    res.status(confirmed ? 200 : 400).type('html').send(renderSignupConfirmationPage({ confirmed }));
  } catch (error) {
    functions.logger.error('Launch signup confirmation failed.', {
      emailHash: parsed.emailHash,
      error: error?.message || error,
    });
    res.status(500).type('html').send(renderSignupConfirmationPage({ confirmed: false }));
  }
});

export const mirrorSignupToSheet = onDocumentCreated({
  document: 'launchSignups/{docId}',
}, async (event) => {
  if (!sheetConfigReady) {
    functions.logger.info('Google Sheets mirror not configured; skipping append.');
    return;
  }

  const data = event.data?.data();
  if (!data) {
    return;
  }

  const utcNow = new Date().toISOString();
  const values = [[
    data.email,
    data.deviceType ?? null,
    data.locale ?? null,
    data.sourceUrl ?? null,
    data.referrer ?? null,
    data.utm ? JSON.stringify(data.utm) : null,
    utcNow,
  ]];

  const client = await sheetsAuth.getClient();

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: SIGNUP_SHEET_RANGE,
    valueInputOption: 'RAW',
    requestBody: { values },
    auth: client,
  });
});
