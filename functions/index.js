import * as functions from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { google } from 'googleapis';

const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GCP_PROJECT,
    private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const mirrorSignupToSheet = onDocumentCreated({
  document: 'launchSignups/{docId}'
}, async (event) => {
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

  const client = await auth.getClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Signups!A:G',
    valueInputOption: 'RAW',
    requestBody: { values },
    auth: client,
  });
});
