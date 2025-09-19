import { CharacterController, loadCharacterSequences, DEFAULT_STATES } from './CharacterController.js';

export function initCharacter() {
  const mount = document.querySelector('[data-character]');
  if (!mount) {
    return null;
  }

  const controller = new CharacterController({
    mount,
    sequences: loadCharacterSequences(),
    stateMeta: DEFAULT_STATES,
  });

  const cleanupCallbacks = [];

  const register = (target, event, handler, options) => {
    if (!target) {
      return;
    }
    target.addEventListener(event, handler, options);
    cleanupCallbacks.push(() => target.removeEventListener(event, handler, options));
  };

  const coarsePointerQuery =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)')
      : null;

  if (coarsePointerQuery) {
    controller.setTouchMode(coarsePointerQuery.matches);
    const handlePointerModeChange = (event) => controller.setTouchMode(event.matches);
    if (typeof coarsePointerQuery.addEventListener === 'function') {
      coarsePointerQuery.addEventListener('change', handlePointerModeChange);
      cleanupCallbacks.push(() =>
        coarsePointerQuery.removeEventListener('change', handlePointerModeChange)
      );
    } else if (typeof coarsePointerQuery.addListener === 'function') {
      coarsePointerQuery.addListener(handlePointerModeChange);
      cleanupCallbacks.push(() => coarsePointerQuery.removeListener(handlePointerModeChange));
    }
  } else if (typeof window !== 'undefined' && 'ontouchstart' in window) {
    controller.setTouchMode(true);
  }

  const computeVisibility = () => {
    const rect = mount.getBoundingClientRect();
    const viewHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.bottom > 0 && rect.top < viewHeight;
  };

  controller.setVisibility(computeVisibility());

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          controller.setVisibility(entry.isIntersecting && entry.intersectionRatio > 0.25);
        });
      },
      { threshold: [0.25, 0.5, 0.75] }
    );
    observer.observe(mount);
    cleanupCallbacks.push(() => observer.disconnect());
  } else {
    const handleVisibilityFallback = () => controller.setVisibility(computeVisibility());
    register(window, 'scroll', handleVisibilityFallback, { passive: true });
    register(window, 'resize', handleVisibilityFallback);
  }

  let touchHoverTimeout = null;
  const clearTouchHoverTimeout = () => {
    if (touchHoverTimeout !== null) {
      window.clearTimeout(touchHoverTimeout);
      touchHoverTimeout = null;
    }
  };

  const handleTouchTap = () => {
    controller.updateProximity(0);
    controller.hover(true);
    clearTouchHoverTimeout();
    touchHoverTimeout = window.setTimeout(() => {
      controller.hover(false);
      touchHoverTimeout = null;
    }, 2400);
  };
  register(mount, 'touchstart', handleTouchTap, { passive: true });
  cleanupCallbacks.push(clearTouchHoverTimeout);

  const handleHoverEnter = () => controller.hover(true);
  const handleHoverLeave = () => controller.hover(false);

  register(mount, 'pointerenter', handleHoverEnter);
  register(mount, 'pointerleave', handleHoverLeave);
  register(mount, 'focusin', handleHoverEnter);
  register(mount, 'focusout', handleHoverLeave);

  const handleUserAction = () => controller.notifyUserEvent();
  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) =>
    register(document, eventName, handleUserAction, { passive: true })
  );

  let scheduledPointerFrame = null;
  const pointerRegion = mount.closest('.shell') ?? document.body;
  const handlePointerMove = (event) => {
    if (scheduledPointerFrame) {
      return;
    }
    scheduledPointerFrame = requestAnimationFrame(() => {
      scheduledPointerFrame = null;
      controller.notifyUserEvent();
      const rect = mount.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      controller.updateProximity(Math.hypot(dx, dy));
    });
  };
  register(pointerRegion, 'pointermove', handlePointerMove, { passive: true });

  const ctaButton = document.querySelector('.footer-signup button');
  register(ctaButton, 'click', () => controller.trigger('celebrate'));

  const handleSignupCelebration = () => controller.trigger('celebrate', { immediate: true });
  register(document, 'signup:success', handleSignupCelebration);

  controller.cleanup = () => {
    cleanupCallbacks.forEach((fn) => fn());
    if (scheduledPointerFrame) {
      cancelAnimationFrame(scheduledPointerFrame);
      scheduledPointerFrame = null;
    }
    controller.destroy();
  };

  return controller;
}
