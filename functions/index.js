import * as functions from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { google } from 'googleapis';
import sgMail from '@sendgrid/mail';

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
const SENDGRID_KEY =
  functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY || SENDGRID_PLACEHOLDER;
const SENDGRID_FROM =
  functions.config().sendgrid?.from || process.env.SENDGRID_FROM || 'Arcade Earth Crew <crew@arcade.earth>';
const sendgridReady = Boolean(SENDGRID_KEY && SENDGRID_KEY !== SENDGRID_PLACEHOLDER);

if (sendgridReady) {
  sgMail.setApiKey(SENDGRID_KEY);
}

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
