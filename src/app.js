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
  const forms = Array.from(document.querySelectorAll('[data-signup-form]'));
  if (!forms.length) {
    return;
  }

  const FEEDBACK_CLASSES = ['signup-feedback--success', 'signup-feedback--error'];

  const setFeedback = (form, type = null, message = '') => {
    const isModalForm = Boolean(form.closest('[data-quiz-modal]'));
    const existing = form.__signupFeedback;

    if (!isModalForm) {
      if (existing instanceof HTMLElement) {
        existing.remove();
        delete form.__signupFeedback;
      }
      if (type) {
        form.dataset.signupState = type;
      } else {
        delete form.dataset.signupState;
      }
      return;
    }

    if (!message) {
      if (existing instanceof HTMLElement) {
        existing.remove();
      }
      delete form.__signupFeedback;
      delete form.dataset.signupState;
      return;
    }

    let feedback = existing;
    if (!(feedback instanceof HTMLElement)) {
      feedback = document.createElement('p');
      feedback.className = 'signup-feedback';
      feedback.dataset.signupFeedback = '';
      feedback.setAttribute('aria-live', 'polite');
      form.__signupFeedback = feedback;
    }

    if (feedback.parentNode !== form.parentNode || feedback.previousElementSibling !== form) {
      form.insertAdjacentElement('afterend', feedback);
    }

    FEEDBACK_CLASSES.forEach((className) => feedback.classList.remove(className));
    feedback.hidden = false;
    feedback.textContent = message;
    if (type) {
      feedback.classList.add(`signup-feedback--${type}`);
      feedback.setAttribute('data-state', type);
      form.dataset.signupState = type;
    } else {
      feedback.removeAttribute('data-state');
      form.dataset.signupState = 'info';
    }
  };

  const db = getFirestoreInstance();
  const signupsCollection = db ? collection(db, 'launchSignups') : null;

  forms.forEach((form) => {
    const emailInput = form.querySelector('[data-signup-input]') || form.querySelector('input[type="email"]');
    if (!emailInput) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      setFeedback(form);

      const rawValue = emailInput.value.trim();
      if (!rawValue) {
        emailInput.focus();
        setFeedback(form, 'error', 'Please enter your email address.');
        return;
      }

      if (!EMAIL_REGEX.test(rawValue)) {
        createToast('Please enter a valid email address.', { variant: 'error' });
        emailInput.focus();
        setFeedback(form, 'error', 'Please enter a valid email address.');
        return;
      }

      const button = form.querySelector('button');
      const originalText = button?.textContent ?? '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Submitting…';
      }

      if (!signupsCollection) {
        window.setTimeout(() => {
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
          form.dispatchEvent(new CustomEvent('signup:error', { bubbles: true }));
          createToast('Signup storage is not configured yet.', { variant: 'error' });
          setFeedback(form, 'error', 'Signup storage is not configured yet.');
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
        setFeedback(form, 'success', 'Thanks, we will ping you soon!');
      } catch (error) {
        console.error('Launch list signup failed', error);
        if (error?.code === 'permission-denied') {
          createToast('Looks like you’re already on the launch list!', { variant: 'error' });
          setFeedback(form, 'error', 'Looks like you’re already on the launch list!');
        } else {
          createToast('We hit turbulence while saving your email.', { variant: 'error' });
          setFeedback(form, 'error', 'We hit turbulence while saving your email.');
        }
        form.dispatchEvent(new CustomEvent('signup:error', { bubbles: true, detail: { error } }));
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  });
}
