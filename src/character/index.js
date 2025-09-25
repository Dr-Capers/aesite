import {
  CharacterController,
  loadCharacterSequences,
  DEFAULT_STATES,
  primeCharacterAssets,
} from './CharacterController.js';

export function initCharacter() {
  const mount = document.querySelector('[data-character]');
  if (!mount) {
    return null;
  }

  const sequences = loadCharacterSequences();
  primeCharacterAssets(sequences);

  const controller = new CharacterController({
    mount,
    sequences,
    stateMeta: DEFAULT_STATES,
  });

  if (mount?.dataset) {
    mount.dataset.characterReady = 'loading';
    controller
      .ready()
      .then(() => {
        mount.dataset.characterReady = 'ready';
      })
      .catch(() => {
        mount.dataset.characterReady = 'error';
      });
  }

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

  const POINTER_STILL_THRESHOLD = 12;
  const LOOKING_DELAY_MS = 3000;
  const LOOKING_COOLDOWN_MS = 9000;
  const RAPID_SPEED_THRESHOLD = 450; // px per second
  const RAPID_REQUIRED_MS = 450;
  const SNEEZE_COOLDOWN_MS = 5000;
  const SELFIE_COOLDOWN_MS = 10000;
  const SPIN_COOLDOWN_MS = 1500;

  let pointerInside = false;
  let hoverLingerTimer = null;
  let hoverLastSample = null;
  let lastSpeedSample = null;
  let rapidMotionAccum = 0;
  let lookingCooldownUntil = 0;
  let sneezeCooldownUntil = 0;
  let selfieCooldownUntil = 0;
  let spinCooldownUntil = 0;
  let lookingRearmTimer = null;

  const requestSpin = () => {
    const now = performance.now();
    if (now < spinCooldownUntil) {
      return;
    }
    spinCooldownUntil = now + SPIN_COOLDOWN_MS;
    controller.trigger('spin', { immediate: true });
  };

  const requestSelfie = () => {
    const now = performance.now();
    if (now < selfieCooldownUntil) {
      return;
    }
    selfieCooldownUntil = now + SELFIE_COOLDOWN_MS;
    controller.trigger('selfie', { immediate: true });
  };

  const emailInput = document.querySelector('.footer-signup input[type="email"]');
  register(emailInput, 'pointerdown', requestSpin);
  register(emailInput, 'focus', requestSpin);

  const socialLinks = Array.from(document.querySelectorAll('.footer__social a'));
  socialLinks.forEach((link) => {
    register(link, 'pointerenter', requestSelfie);
    register(link, 'focus', requestSelfie);
  });

  const isPointerEvent = (event) => Boolean(event?.type?.startsWith('pointer'));
  const clearHoverLinger = () => {
    if (hoverLingerTimer !== null) {
      window.clearTimeout(hoverLingerTimer);
      hoverLingerTimer = null;
    }
  };

  const clearLookingRearm = () => {
    if (lookingRearmTimer !== null) {
      window.clearTimeout(lookingRearmTimer);
      lookingRearmTimer = null;
    }
  };

  const scheduleHoverLinger = () => {
    if (!pointerInside) {
      clearHoverLinger();
      return;
    }

    if (controller.currentState === 'sneeze') {
      return;
    }

    if (performance.now() < lookingCooldownUntil) {
      return;
    }

    const allowLookingFrom = new Set(['idle', 'hover']);

    clearHoverLinger();
    clearLookingRearm();

    hoverLingerTimer = window.setTimeout(() => {
      hoverLingerTimer = null;

      if (!pointerInside) {
        return;
      }

      if (performance.now() < lookingCooldownUntil) {
        scheduleHoverLinger();
        return;
      }

      if (!allowLookingFrom.has(controller.currentState)) {
        scheduleHoverLinger();
        return;
      }

      if (!controller.sequences?.looking?.frames?.length) {
        return;
      }

      if (typeof controller.playLoopingState === 'function') {
        controller.playLoopingState('looking', { loops: 3, fallback: 'idle' });
      } else {
        controller.trigger('looking', { immediate: true });
      }

      lookingCooldownUntil = performance.now() + LOOKING_COOLDOWN_MS;
      clearLookingRearm();
      lookingRearmTimer = window.setTimeout(() => {
        lookingRearmTimer = null;
        if (!pointerInside) {
          lookingCooldownUntil = 0;
          return;
        }
        scheduleHoverLinger();
      }, LOOKING_COOLDOWN_MS);
    }, LOOKING_DELAY_MS);
  };

  const triggerSneeze = (now) => {
    if (now < sneezeCooldownUntil) {
      return;
    }

    const sneezeSequence = controller.sequences?.sneeze;
    if (!sneezeSequence?.frames?.length) {
      return;
    }

    sneezeCooldownUntil = now + SNEEZE_COOLDOWN_MS;
    rapidMotionAccum = 0;

    clearHoverLinger();
    clearLookingRearm();

    const sneezeMeta =
      typeof controller.getMetaForState === 'function'
        ? controller.getMetaForState('sneeze')
        : null;
    const sneezeFps = sneezeMeta?.fps ?? sneezeSequence.fps ?? 60;
    const sneezeDuration =
      sneezeSequence.frames.length > 0
        ? (sneezeSequence.frames.length * 1000) / Math.max(sneezeFps, 1)
        : 1600;

    lookingCooldownUntil = now + sneezeDuration;

    const sneezeFallback = pointerInside ? 'hover' : 'idle';

    if (typeof controller.playLoopingState === 'function') {
      controller.playLoopingState('sneeze', { loops: 1, fallback: sneezeFallback });
    } else if (typeof controller.playTransientState === 'function') {
      controller.playTransientState('sneeze', sneezeDuration, { fallback: sneezeFallback });
    } else {
      controller.trigger('sneeze', { immediate: true });
      if (pointerInside) {
        controller.trigger('hover');
      } else {
        controller.trigger('idle');
      }
    }

    lookingRearmTimer = window.setTimeout(() => {
      lookingRearmTimer = null;
      if (!pointerInside) {
        lookingCooldownUntil = 0;
        return;
      }
      lookingCooldownUntil = performance.now();
      scheduleHoverLinger();
    }, sneezeDuration + 80);
  };

  const resetPointerTracking = () => {
    clearHoverLinger();
    clearLookingRearm();
    hoverLastSample = null;
    lastSpeedSample = null;
    rapidMotionAccum = 0;
    lookingCooldownUntil = 0;
  };

  const handleHoverEnter = (event) => {
    controller.hover(true);
    if (!isPointerEvent(event) || event.pointerType === 'touch') {
      return;
    }
    pointerInside = true;
    const now = performance.now();
    const point = { x: event.clientX, y: event.clientY, time: now };
    hoverLastSample = point;
    lastSpeedSample = point;
    rapidMotionAccum = 0;
    scheduleHoverLinger();
  };

  const handleHoverLeave = (event) => {
    controller.hover(false);
    if (isPointerEvent(event)) {
      pointerInside = false;
    }
    resetPointerTracking();
  };

  register(mount, 'pointermove', (event) => {
    if (event.pointerType === 'touch' || !pointerInside) {
      return;
    }
    const now = performance.now();
    const currentPoint = { x: event.clientX, y: event.clientY, time: now };

    if (hoverLastSample) {
      const dist = Math.hypot(currentPoint.x - hoverLastSample.x, currentPoint.y - hoverLastSample.y);
      if (dist > POINTER_STILL_THRESHOLD) {
        scheduleHoverLinger();
      }
    } else {
      scheduleHoverLinger();
    }
    hoverLastSample = currentPoint;

    if (lastSpeedSample) {
      const dist = Math.hypot(currentPoint.x - lastSpeedSample.x, currentPoint.y - lastSpeedSample.y);
      const dt = now - lastSpeedSample.time;
      if (dt > 0) {
        const speed = (dist / dt) * 1000;
        if (speed >= RAPID_SPEED_THRESHOLD) {
          rapidMotionAccum = Math.min(RAPID_REQUIRED_MS, rapidMotionAccum + dt);
          if (rapidMotionAccum >= RAPID_REQUIRED_MS) {
            triggerSneeze(now);
          }
        } else {
          rapidMotionAccum = Math.max(0, rapidMotionAccum - dt * 0.6);
        }
      }
    }
    lastSpeedSample = currentPoint;
  }, { passive: true });

  register(mount, 'pointerenter', handleHoverEnter);
  register(mount, 'pointerleave', handleHoverLeave);
  register(mount, 'pointercancel', handleHoverLeave);
  register(mount, 'focusin', handleHoverEnter);
  register(mount, 'focusout', handleHoverLeave);

  cleanupCallbacks.push(() => {
    resetPointerTracking();
    pointerInside = false;
  });

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
