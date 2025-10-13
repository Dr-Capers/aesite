const MODAL_SELECTOR = '[data-thumb-modal]';
const TRIGGER_SELECTOR = '[data-thumb-modal-trigger]';
const CLOSE_SELECTOR = '[data-thumb-modal-close]';
const BODY_LOCK_CLASS = 'thumb-modal-open';
const FOOTER_CLOSE_EVENT = 'ae:footer-other-close';
const MODAL_PATHS = ['/thumb-war', '/download'];

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const getCurrentUrl = () => {
  const { pathname, search, hash } = window.location;
  return `${pathname || '/'}${search || ''}${hash || ''}`;
};

const getPreferredPath = (path) => {
  if (MODAL_PATHS.includes(path)) {
    return path;
  }
  return MODAL_PATHS[0];
};

export function initThumbModal() {
  const modal = document.querySelector(MODAL_SELECTOR);
  if (!modal) {
    return;
  }

  const dialog = modal.querySelector('.thumb-modal__dialog');
  const backdrop = modal.querySelector('.thumb-modal__backdrop');
  const closeElements = Array.from(modal.querySelectorAll(CLOSE_SELECTOR));
  const triggers = Array.from(document.querySelectorAll(TRIGGER_SELECTOR));

  if (!dialog || !backdrop || !closeElements.length) {
    return;
  }

  let isOpen = false;
  let focusable = [];
  let lastFocused = null;
  let baseUrl = MODAL_PATHS.includes(window.location.pathname) ? '/' : getCurrentUrl();
  let activePath = MODAL_PATHS[0];

  const updateFocusable = () => {
    focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTORS))
      .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('tabindex') !== '-1');
  };

  const focusFirst = () => {
    updateFocusable();
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    if (first instanceof HTMLElement) {
      first.focus({ preventScroll: true });
    }
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab' || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      if (last instanceof HTMLElement) {
        last.focus();
      }
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      if (first instanceof HTMLElement) {
        first.focus();
      }
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
    }
  };

  const closeModal = ({ push = true } = {}) => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    modal.classList.remove('thumb-modal--visible');
    document.body.classList.remove(BODY_LOCK_CLASS);
    document.removeEventListener('keydown', handleKeydown);

    const finish = () => {
      modal.hidden = true;
      modal.removeEventListener('transitionend', finish);
      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus({ preventScroll: true });
      }
    };

    modal.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(() => {
      if (!modal.hidden) {
        finish();
      }
    }, 260);

    if (push && MODAL_PATHS.includes(window.location.pathname)) {
      const target = baseUrl || '/';
      const current = getCurrentUrl();
      if (target !== current) {
        try {
          history.pushState({ thumb: false }, '', target);
        } catch (error) {
          console.warn('Failed to restore base path for Thumb War modal', error);
        }
      }
    }
  };

  const openModal = ({ push = true, path } = {}) => {
    if (isOpen) {
      return;
    }

    const targetPath = getPreferredPath(path);
    activePath = targetPath;

    const footerOther = document.querySelector('.footer__other');
    if (footerOther) {
      footerOther.dispatchEvent(new CustomEvent(FOOTER_CLOSE_EVENT, { bubbles: true }));
    }

    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;

    requestAnimationFrame(() => {
      modal.classList.add('thumb-modal--visible');
      document.body.classList.add(BODY_LOCK_CLASS);
      document.addEventListener('keydown', handleKeydown);
      isOpen = true;
      focusFirst();
    });

    if (push) {
      if (!MODAL_PATHS.includes(window.location.pathname)) {
        baseUrl = MODAL_PATHS.includes(window.location.pathname) ? '/' : getCurrentUrl();
        try {
          history.pushState({ thumb: true }, '', targetPath);
        } catch (error) {
          console.warn('Failed to push Thumb War modal path', error);
        }
      } else if (window.location.pathname !== targetPath) {
        try {
          history.replaceState({ thumb: true }, '', targetPath);
        } catch (error) {
          console.warn('Failed to replace Thumb War modal path', error);
        }
      }
    }
  };

  closeElements.forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const target = trigger.getAttribute('href') || MODAL_PATHS[0];
      openModal({ path: target });
    });
  });

  window.addEventListener('popstate', () => {
    if (MODAL_PATHS.includes(window.location.pathname)) {
      openModal({ push: false, path: window.location.pathname });
    } else if (isOpen) {
      closeModal({ push: false });
    }
  });

  if (MODAL_PATHS.includes(window.location.pathname)) {
    openModal({ push: false, path: window.location.pathname });
  }
}
