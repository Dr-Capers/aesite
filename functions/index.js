import * as functions from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import sgMail from '@sendgrid/mail';
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

const SENDGRID_PLACEHOLDER = 'SENDGRID_API_KEY_PLACEHOLDER';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || SENDGRID_PLACEHOLDER;
const SENDGRID_FROM =
  process.env.SENDGRID_FROM || 'Arcade Earth Crew <crew@arcade.earth>';
const sendgridReady = Boolean(SENDGRID_KEY && SENDGRID_KEY !== SENDGRID_PLACEHOLDER);

if (sendgridReady) {
  sgMail.setApiKey(SENDGRID_KEY);
}

const STRIPE_API_VERSION = '2024-12-18.acacia';
const TOKEN_EXPIRY_DAYS = Number(process.env.COMIC_LIBRARY_TOKEN_EXPIRY_DAYS || 14);
const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000;
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

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
  res.status(status).set('Cache-Control', 'no-store').json(payload);
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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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

async function sendLibraryAccessEmail(email, token) {
  if (!sendgridReady) {
    functions.logger.info('SendGrid key not configured; skipping Library email.', { email });
    return;
  }

  const baseUrl = process.env.ARCADE_EARTH_LIBRARY_URL_BASE || 'https://arcade.earth';
  const libraryUrl = `${baseUrl.replace(/\/$/, '')}/library/session?t=${encodeURIComponent(token)}`;

  await sgMail.send({
    to: email,
    from: SENDGRID_FROM,
    subject: 'Your Arcade Earth Library is ready',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; padding: 24px; color: #f7f7f2; background-color: #020203;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Your comic is ready.</h1>
        <p style="font-size: 16px; line-height: 1.6;">Thanks for supporting Arcade Earth. Open your Library to read, watch, or download your purchased media.</p>
        <p style="margin: 28px 0;"><a href="${libraryUrl}" style="display: inline-block; padding: 12px 18px; color: #020203; background: #f7f7f2; text-decoration: none; font-weight: 700;">Visit My Library</a></p>
        <p style="font-size: 13px; opacity: 0.72;">This secure Library link expires in ${TOKEN_EXPIRY_DAYS} days. You can request a new one from Arcade Earth later.</p>
      </div>
    `,
  });
}

function getSuccessUrl() {
  const base = process.env.COMIC_SUCCESS_URL_BASE || 'https://arcade.earth';
  return `${base.replace(/\/$/, '')}/comic/success?session_id={CHECKOUT_SESSION_ID}`;
}

function getCancelUrl() {
  const base = process.env.COMIC_CANCEL_URL_BASE || 'https://arcade.earth';
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

  await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (orderSnap.exists && orderSnap.data()?.status === 'paid') {
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

  const { token } = await createLibraryToken({ email, orderId: session.id, entitlementId: entitlementRef.id });
  await sendLibraryAccessEmail(email, token);
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

    const checkoutConfig = {
      mode: 'payment',
      line_items: [{ price: config.priceId, quantity: count }],
      customer_creation: 'always',
      success_url: getSuccessUrl(),
      cancel_url: getCancelUrl(),
      automatic_tax: { enabled: true },
      metadata: {
        sku,
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

export const stripeComicWebhook = onRequest({ invoker: 'public', secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
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
          await orderDoc.ref.set({
            status: event.type === 'charge.refunded' ? 'refunded' : 'disputed',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          const entitlements = await db.collection('comicEntitlements').where('orderId', '==', orderDoc.id).get();
          await Promise.all(entitlements.docs.map((entitlement) => entitlement.ref.set({
            status: event.type === 'charge.refunded' ? 'refunded' : 'revoked',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true })));
        }));
      }
    }

    res.status(200).send('ok');
  } catch (error) {
    functions.logger.error('Stripe comic webhook failed.', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export const resendComicAccess = onRequest({ invoker: 'public' }, async (req, res) => {
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
      await sendLibraryAccessEmail(email, token);
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
    range: 'Signups!A:G',
    valueInputOption: 'RAW',
    requestBody: { values },
    auth: client,
  });
});

export const launchWelcomeEmail = onDocumentCreated({
  document: 'launchSignups/{docId}',
}, async (event) => {
  if (!sendgridReady) {
    functions.logger.info('SendGrid key not configured; skipping welcome email.');
    return;
  }

  const data = event.data?.data();
  if (!data?.email) {
    functions.logger.warn('Signup document missing email; cannot send welcome message.');
    return;
  }

  const message = {
    to: data.email,
    from: SENDGRID_FROM,
    subject: 'Welcome aboard Arcade Earth 🚀',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; text-align: center; padding: 24px; color: #f5f7ff; background-color: #040414;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Greetings, Space Cadet!</h1>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          You just secured your seat on the Arcade Earth launch shuttle.<br/>
          We’ll ping you before liftoff with mission briefings, secret drops, and maybe a cheat code or two.
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Until then, keep your thrusters warm, your high score higher, and your notifications turned on.
        </p>
        <p style="font-size: 14px; opacity: 0.75;">– The Planetary Games Crew</p>
      </div>
    `,
  };

  try {
    await sgMail.send(message);
    functions.logger.info('Welcome email sent', { email: data.email });
  } catch (error) {
    functions.logger.error('Failed to send welcome email', {
      email: data.email,
      error: error?.response?.body || error,
    });
  }
});
