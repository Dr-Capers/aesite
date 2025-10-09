import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from './lib/firebase.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToast(message, { variant = 'success' } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast${variant === 'error' ? ' toast--error' : ''}`;
  toast.role = 'status';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  window.setTimeout(() => {
    toast.classList.remove('toast--visible');
    window.setTimeout(() => toast.remove(), 320);
  }, 3200);

  return toast;
}

function collectMetadata(normalizedEmail) {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  });

  const metadata = {
    email: normalizedEmail,
    submittedAt: serverTimestamp(),
    locale: typeof navigator !== 'undefined' ? navigator.language ?? null : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null,
    referrer: document.referrer || null,
    sourceUrl: window.location.href,
    deviceType:
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(pointer: coarse)').matches
          ? 'coarse-pointer'
          : 'fine-pointer'
        : 'unknown',
  };

  if (Object.keys(utm).length) {
    metadata.utm = utm;
  }

  return metadata;
}

export function initSignupForm() {
  const form = document.querySelector('.footer-signup');
  const emailInput = document.querySelector('#email');

  if (!form || !emailInput) {
    return;
  }

  const db = getFirestoreInstance();
  const signupsCollection = db ? collection(db, 'launchSignups') : null;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawValue = emailInput.value.trim();
    if (!rawValue) {
      emailInput.focus();
      return;
    }

    if (!EMAIL_REGEX.test(rawValue)) {
      createToast('Please enter a valid email address.', { variant: 'error' });
      emailInput.focus();
      return;
    }

    const button = form.querySelector('button');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Submitting…';

    if (!signupsCollection) {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
        form.dispatchEvent(new CustomEvent('signup:error', { bubbles: true }));
        createToast('Signup storage is not configured yet.', { variant: 'error' });
      }, 200);
      return;
    }

    const normalizedEmail = rawValue.toLowerCase();
    const docRef = signupsCollection ? doc(signupsCollection, normalizedEmail) : null;

    try {
      await setDoc(docRef, collectMetadata(normalizedEmail));

      form.reset();
      createToast('Thanks, we will ping you soon!');
      form.dispatchEvent(new CustomEvent('signup:success', { bubbles: true }));
    } catch (error) {
      console.error('Launch list signup failed', error);
      if (error?.code === 'permission-denied') {
        createToast('Looks like you’re already on the launch list!', { variant: 'error' });
      } else {
        createToast('We hit turbulence while saving your email.', { variant: 'error' });
      }
      form.dispatchEvent(new CustomEvent('signup:error', { bubbles: true, detail: { error } }));
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}
