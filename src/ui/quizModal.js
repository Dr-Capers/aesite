const MODAL_SELECTOR = '[data-quiz-modal]';
const TRIGGER_SELECTOR = '[data-quiz-modal-trigger]';
const CLOSE_SELECTOR = '[data-quiz-modal-close]';
const BODY_LOCK_CLASS = 'quiz-modal-open';
const FOOTER_CLOSE_EVENT = 'ae:footer-other-close';
const QUIZ_PATH = '/1upquiz';

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

export function initQuizModal() {
  const modal = document.querySelector(MODAL_SELECTOR);
  if (!modal) {
    return;
  }

  const dialog = modal.querySelector('.quiz-modal__dialog');
  const backdrop = modal.querySelector('.quiz-modal__backdrop');
  const closeElements = Array.from(modal.querySelectorAll(CLOSE_SELECTOR));
  const triggers = Array.from(document.querySelectorAll(TRIGGER_SELECTOR));

  if (!dialog || !backdrop || !closeElements.length) {
    return;
  }

  let isOpen = false;
  let focusable = [];
  let lastFocused = null;
  let basePath = window.location.pathname === QUIZ_PATH ? '/' : getCurrentUrl();

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
    modal.classList.remove('quiz-modal--visible');
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

    if (push && window.location.pathname === QUIZ_PATH) {
      const target = basePath || '/';
      const currentUrl = getCurrentUrl();
      if (target !== currentUrl) {
        try {
          history.pushState({ quiz: false }, '', target);
        } catch (error) {
          console.warn('Failed to restore base path for quiz modal', error);
        }
      }
    }
  };

  const openModal = ({ push = true } = {}) => {
    if (isOpen) {
      return;
    }

    const trigger = document.querySelector('.footer__other');
    if (trigger) {
      trigger.dispatchEvent(new CustomEvent(FOOTER_CLOSE_EVENT, { bubbles: true }));
    }

    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;

    requestAnimationFrame(() => {
      modal.classList.add('quiz-modal--visible');
      document.body.classList.add(BODY_LOCK_CLASS);
      document.addEventListener('keydown', handleKeydown);
      isOpen = true;
      focusFirst();
    });

    if (push) {
      if (window.location.pathname !== QUIZ_PATH) {
        basePath = window.location.pathname === QUIZ_PATH ? '/' : getCurrentUrl();
        try {
          history.pushState({ quiz: true }, '', QUIZ_PATH);
        } catch (error) {
          console.warn('Failed to push quiz modal path', error);
        }
      } else {
        try {
          history.replaceState({ quiz: true }, '', QUIZ_PATH);
        } catch (error) {
          console.warn('Failed to replace quiz modal state', error);
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
      openModal();
    });
  });

  window.addEventListener('popstate', () => {
    if (window.location.pathname === QUIZ_PATH) {
      openModal({ push: false });
    } else if (isOpen) {
      closeModal({ push: false });
    }
  });

  if (window.location.pathname === QUIZ_PATH) {
    openModal({ push: false });
  }
}
