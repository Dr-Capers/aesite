import * as functions from 'firebase-functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { Resend } from 'resend';
import Stripe from 'stripe';

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

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
const RESEND_FROM = process.env.RESEND_FROM || 'hello@arcade.earth';
const SUPPORT_EMAIL = process.env.ARCADE_EARTH_SUPPORT_EMAIL || 'hello@arcade.earth';
const FULFILLMENT_NOTIFY_EMAIL = process.env.FULFILLMENT_NOTIFY_EMAIL || SUPPORT_EMAIL;
const DEFAULT_SITE_BASE = 'https://arcade.earth';
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

export const launchWelcomeEmail = onDocumentCreated({
  document: 'launchSignups/{docId}',
  secrets: [RESEND_API_KEY],
}, async (event) => {
  const data = event.data?.data();
  if (!data?.email) {
    functions.logger.warn('Signup document missing email; cannot send welcome message.');
    return;
  }

  const html = renderEmailShell({
    title: 'Welcome aboard Arcade Earth.',
    intro: 'You just joined the Arcade Earth launch list.',
    body: `
      <p style="margin:0 0 18px; color:#d7d7cf; font-size:15px; line-height:1.6;">
        We will send updates on Rise of Vector, Thumb War, and new Planetary Games drops.
      </p>
      <p style="margin:0; color:#a8a89f; font-size:13px; line-height:1.6;">The Planetary Games Crew</p>
    `,
  });

  const message = {
    to: data.email,
    subject: 'Welcome aboard Arcade Earth',
    html,
    tag: 'launch-welcome',
  };

  try {
    await sendTransactionalEmail(message);
    functions.logger.info('Welcome email sent', { email: data.email });
  } catch (error) {
    functions.logger.error('Failed to send welcome email', {
      email: data.email,
      error: error?.response?.body || error,
    });
  }
});
