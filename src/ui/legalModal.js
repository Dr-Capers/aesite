import { getLegalContent } from './legalLoader.js';

const BODY_LOCK_CLASS = 'legal-modal-open';
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input[type="text"]:not([disabled])',
  'input[type="email"]:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const PANEL_TO_PATH = {
  terms: '/terms',
  privacy: '/privacy',
};

const PATH_TO_PANEL = Object.fromEntries(
  Object.entries(PANEL_TO_PATH).map(([panel, path]) => [path, panel])
);

export function initLegalModal() {
  const modal = document.querySelector('[data-legal-modal]');
  if (!modal) {
    return;
  }

  const tabs = Array.from(modal.querySelectorAll('[data-legal-tab]'));
  const closeButtons = Array.from(modal.querySelectorAll('[data-legal-close]'));
  const triggers = Array.from(document.querySelectorAll('[data-legal-trigger]'));
  const body = modal.querySelector('.legal-modal__body');
  const content = modal.querySelector('[data-legal-content]');

  if (!tabs.length || !content || !body) {
    return;
  }

  let activePanel = 'terms';
  let lastFocusedElement = null;
  let focusableCache = [];
  let isOpen = false;

  let basePath = window.location.pathname;
  if (PATH_TO_PANEL[basePath]) {
    basePath = '/';
  }

  const initialPanel = PATH_TO_PANEL[window.location.pathname];
  const initialState = {
    legal: Boolean(initialPanel),
    panel: initialPanel || null,
  };
  try {
    history.replaceState(initialState, '', window.location.pathname);
  } catch (error) {
    console.warn('Failed to initialize history state', error);
  }

  const getTab = (id) => tabs.find((tab) => tab.dataset.legalTab === id);

  const updateFocusable = () => {
    focusableCache = Array.from(
      modal.querySelectorAll(FOCUSABLE_SELECTORS)
    ).filter((node) => !node.closest('[hidden]'));
  };

  const renderContent = (id) => {
    content.innerHTML = getLegalContent(id);
    const activeTab = getTab(id);
    if (activeTab?.id) {
      content.setAttribute('aria-labelledby', activeTab.id);
    }
  };

  const setActive = (id) => {
    activePanel = id;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.legalTab === id;
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    renderContent(id);
    updateFocusable();
    body.scrollTop = 0;
  };

  const showPanel = (id, { focusTab = true, push = true } = {}) => {
    if (!id) {
      return;
    }

    setActive(id);

    if (focusTab) {
      const activeTab = getTab(id);
      if (activeTab) {
        activeTab.focus({ preventScroll: true });
      }
    }

    if (push) {
      const path = PANEL_TO_PATH[id];
      if (!path) {
        return;
      }
      const state = { legal: true, panel: id };
      if (window.location.pathname !== path) {
        try {
          history.pushState(state, '', path);
        } catch (error) {
          console.warn('Failed to push history state', error);
        }
      } else {
        try {
          history.replaceState(state, '', path);
        } catch (error) {
          console.warn('Failed to replace history state', error);
        }
      }
    }
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab' || focusableCache.length === 0) {
      return;
    }

    const first = focusableCache[0];
    const last = focusableCache[focusableCache.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
    }
  };

  const openModal = async (id = 'terms', { push = true } = {}) => {
    if (!modal.classList.contains('legal-modal--visible')) {
      lastFocusedElement = document.activeElement;
      modal.hidden = false;
      requestAnimationFrame(() => {
        modal.classList.add('legal-modal--visible');
      });
      document.body.classList.add(BODY_LOCK_CLASS);
      document.addEventListener('keydown', handleKeydown);
      isOpen = true;
    }

    showPanel(id, { push });
  };

  const closeModal = ({ push = true } = {}) => {
    if (!modal.classList.contains('legal-modal--visible')) {
      return;
    }
    modal.classList.remove('legal-modal--visible');
    document.body.classList.remove(BODY_LOCK_CLASS);
    document.removeEventListener('keydown', handleKeydown);
    const finish = () => {
      modal.hidden = true;
      modal.removeEventListener('transitionend', finish);
      if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus({ preventScroll: true });
      }
    };
    modal.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(() => {
      if (!modal.hidden) {
        finish();
      }
    }, 260);
    isOpen = false;

    if (push && window.location.pathname !== basePath) {
      try {
        history.pushState({ legal: false, panel: null }, '', basePath);
      } catch (error) {
        console.warn('Failed to push base path state', error);
      }
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const id = tab.dataset.legalTab;
      if (!id) {
        return;
      }
      showPanel(id, { focusTab: true, push: true });
    });

    tab.addEventListener('keydown', (event) => {
      const id = tab.dataset.legalTab;
      if (!id) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showPanel(id, { focusTab: true, push: true });
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const currentIndex = tabs.findIndex((button) => button.dataset.legalTab === id);
      if (currentIndex === -1) {
        return;
      }
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (!nextTab) {
        return;
      }
      const nextId = nextTab.dataset.legalTab;
      if (nextId) {
        showPanel(nextId, { focusTab: true, push: true });
      }
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (event) => {
    const backdrop = modal.querySelector('.legal-modal__backdrop');
    if (event.target === backdrop) {
      closeModal();
    }
  });

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const id = trigger.dataset.legalTrigger || 'terms';
      openModal(id, { push: true });
    });
  });

  window.addEventListener('popstate', (event) => {
    const pathPanel = PATH_TO_PANEL[window.location.pathname];
    if (pathPanel) {
      openModal(pathPanel, { push: false });
    } else if (isOpen) {
      closeModal({ push: false });
    }
  });

  if (initialPanel) {
    openModal(initialPanel, { push: false });
  }
}
