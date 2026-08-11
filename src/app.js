const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECAPTCHA_SITE_KEY = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
let recaptchaScriptPromise;

function loadRecaptcha() {
  if (window.grecaptcha?.enterprise) return Promise.resolve(window.grecaptcha.enterprise);
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  const scriptUrl = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${scriptUrl}"]`);
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve(window.grecaptcha?.enterprise), { once: true });
    script.addEventListener('error', () => reject(new Error('Verification failed to load.')), { once: true });
    if (!existing) {
      script.src = scriptUrl;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return recaptchaScriptPromise;
}

async function createRecaptchaToken() {
  const recaptcha = await loadRecaptcha();
  if (!recaptcha) throw new Error('Verification is unavailable.');
  await new Promise((resolve) => recaptcha.ready(resolve));
  return recaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'launch_signup' });
}

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

function collectAttribution() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  });

  const metadata = {
    locale: typeof navigator !== 'undefined' ? navigator.language ?? null : null,
    referrer: document.referrer || null,
    sourceUrl: window.location.href,
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
    const existing = form.__signupFeedback || form.querySelector('[data-signup-feedback]');

    if (!message) {
      if (existing instanceof HTMLElement) {
        existing.hidden = true;
        existing.textContent = '';
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

    if (!feedback.parentNode) {
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

  forms.forEach((form) => {
    const emailInput = form.querySelector('[data-signup-input]') || form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    if (!emailInput) {
      return;
    }

    form.dataset.signupStartedAt = String(Date.now());

    if (!RECAPTCHA_SITE_KEY) {
      form.setAttribute('data-signup-paused', '');
      emailInput.disabled = true;
      if (button) button.disabled = true;
      setFeedback(form, null, 'Email signup is temporarily paused while verification is configured.');
      return;
    }

    if (button) button.disabled = true;
    loadRecaptcha()
      .then((recaptcha) => {
        if (!recaptcha) throw new Error('Verification is unavailable.');
        if (button) button.disabled = false;
      })
      .catch((error) => {
        console.error('reCAPTCHA failed to initialize', error);
        setFeedback(form, 'error', 'Verification could not load. Please refresh and try again.');
      });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (form.hasAttribute('data-signup-paused')) {
        setFeedback(form, 'error', 'Email signup is temporarily paused while we upgrade verification.');
        return;
      }

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

      const originalText = button?.textContent ?? '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Submitting…';
      }

      const normalizedEmail = rawValue.toLowerCase();
      const website = new FormData(form).get('website')?.toString() || '';

      try {
        const recaptchaToken = await createRecaptchaToken();
        const response = await fetch('/api/submitLaunchSignup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            recaptchaToken,
            recaptchaSiteKey: RECAPTCHA_SITE_KEY,
            website,
            startedAt: Number(form.dataset.signupStartedAt),
            attribution: collectAttribution(),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Signup is unavailable right now.');
        }

        form.reset();
        form.dataset.signupStartedAt = String(Date.now());
        createToast('If eligible, a confirmation link is on its way.');
        form.dispatchEvent(new CustomEvent('signup:success', { bubbles: true }));
        setFeedback(form, 'success', 'If eligible, a confirmation link is on its way.');
      } catch (error) {
        console.error('Launch list signup failed', error);
        const message = error?.message || 'Email signup is unavailable right now. Please try again later.';
        createToast(message, { variant: 'error' });
        setFeedback(form, 'error', message);
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
