const OTHER_SELECTOR = '.footer__other';
const TRIGGER_SELECTOR = '.footer__other-trigger';
const POPOVER_SELECTOR = '.footer__other-popover';

function setExpanded(trigger, popover, isOpen) {
  if (!trigger || !popover) {
    return;
  }
  trigger.setAttribute('aria-expanded', String(isOpen));
  popover.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

export function initFooterOtherPopover() {
  if (typeof document === 'undefined') {
    return;
  }

  const container = document.querySelector(OTHER_SELECTOR);
  if (!container) {
    return;
  }

  const trigger = container.querySelector(TRIGGER_SELECTOR);
  const popover = container.querySelector(POPOVER_SELECTOR);
  if (!trigger || !popover) {
    return;
  }

  let isOpen = false;
  let focusTrap = null;
  let resizeHandler = null;

  const updateArrowPosition = () => {
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    if (!triggerRect.width || !popoverRect.width) {
      return;
    }
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const offsetFromLeft = triggerCenter - popoverRect.left;
    const clampedOffset = Math.min(
      Math.max(offsetFromLeft, 18),
      popoverRect.width - 18
    );
    popover.style.setProperty('--arrow-center', `${clampedOffset}px`);
  };

  const closePopover = () => {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    setExpanded(trigger, popover, false);
    if (focusTrap) {
      focusTrap.disconnect();
      focusTrap = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
  };

  const handleDocumentClick = (event) => {
    if (!isOpen) {
      return;
    }
    if (container.contains(event.target)) {
      return;
    }
    closePopover();
  };

  const handleEscape = (event) => {
    if (!isOpen || event.key !== 'Escape') {
      return;
    }
    event.stopPropagation();
    closePopover();
    trigger.focus();
  };

  const activateFocusTrap = () => {
    const focusableElements = popover.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusableElements.length) {
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    const handleKeydown = (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    popover.addEventListener('keydown', handleKeydown);
    focusTrap = {
      disconnect() {
        popover.removeEventListener('keydown', handleKeydown);
      },
    };
    first.focus();
  };

  const openPopover = () => {
    if (isOpen) {
      return;
    }
    isOpen = true;
    setExpanded(trigger, popover, true);
    activateFocusTrap();
    requestAnimationFrame(() => {
      updateArrowPosition();
      if (!resizeHandler) {
        resizeHandler = () => updateArrowPosition();
        window.addEventListener('resize', resizeHandler);
      }
    });
  };

  const togglePopover = () => {
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  };

  trigger.addEventListener('click', togglePopover);
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPopover();
    }
  });

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleEscape);
}
