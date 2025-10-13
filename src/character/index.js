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

  const fallback = mount.querySelector('[data-character-fallback]');
  const concealFallback = () => {
    if (fallback && !fallback.hidden) {
      fallback.hidden = true;
    }
  };
  const revealFallback = () => {
    if (fallback && fallback.hidden) {
      fallback.hidden = false;
    }
  };
  concealFallback();

  let coarsePointerQuery = null;
  let initialTouchMode = false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    initialTouchMode = coarsePointerQuery.matches;
  } else if (typeof window !== 'undefined' && 'ontouchstart' in window) {
    initialTouchMode = true;
  }

  const initialMobileMode = initialTouchMode;

  const sequences = loadCharacterSequences({ mode: initialMobileMode ? 'mobile' : 'desktop' });
  primeCharacterAssets(sequences);

  const hasPlayableSequence = Object.values(sequences ?? {}).some(
    (sequence) => Array.isArray(sequence?.frames) && sequence.frames.length > 0
  );

  if (!hasPlayableSequence) {
    if (mount?.dataset) {
      mount.dataset.characterReady = 'error';
    }
    revealFallback();
    return null;
  }

  const controller = new CharacterController({
    mount,
    sequences,
    stateMeta: DEFAULT_STATES,
    touchMode: initialTouchMode,
    mobileMode: initialMobileMode,
  });

  const cleanupCallbacks = [];
  if (mount?.dataset) {
    mount.dataset.characterReady = 'loading';
  }

  controller.ready().catch(() => {
    if (mount?.dataset) {
      mount.dataset.characterReady = 'error';
    }
    revealFallback();
  });

  const sprite = mount.querySelector('.character-display__sprite');
  if (sprite) {
    const handleSpriteLoad = () => {
      if (mount?.dataset) {
        mount.dataset.characterReady = 'ready';
      }
      concealFallback();
    };

    const handleSpriteError = () => {
      const hasRenderableSprite =
        typeof sprite.naturalWidth === 'number' &&
        typeof sprite.naturalHeight === 'number' &&
        sprite.naturalWidth > 0 &&
        sprite.naturalHeight > 0;
      if (!hasRenderableSprite) {
        if (mount?.dataset) {
          mount.dataset.characterReady = 'error';
        }
        revealFallback();
      } else if (mount?.dataset?.characterReady !== 'ready') {
        mount.dataset.characterReady = 'ready';
        concealFallback();
      }
    };

    sprite.addEventListener('load', handleSpriteLoad);
    sprite.addEventListener('error', handleSpriteError);
    cleanupCallbacks.push(() => {
      sprite.removeEventListener('load', handleSpriteLoad);
      sprite.removeEventListener('error', handleSpriteError);
    });

    if (sprite.complete) {
      if (sprite.naturalWidth > 0) {
        handleSpriteLoad();
      } else {
        handleSpriteError();
      }
    }
  }

  const mobileMode = controller.mobileMode;
  let scheduledPointerFrame = null;

  const register = (target, event, handler, options) => {
    if (!target) {
      return;
    }
    target.addEventListener(event, handler, options);
    cleanupCallbacks.push(() => target.removeEventListener(event, handler, options));
  };

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
  } else if (initialTouchMode) {
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

  const setupDesktopInteractions = () => {
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
    const LOOKING_COOLDOWN_MS = 4000;
    const RAPID_SPEED_THRESHOLD = 450; // px per second
    const RAPID_REQUIRED_MS = 450;
    const SNEEZE_COOLDOWN_MS = 5000;

    let pointerInside = false;
    let hoverLingerTimer = null;
    let hoverLastSample = null;
    let lastSpeedSample = null;
    let rapidMotionAccum = 0;
    let lookingCooldownUntil = 0;
    let sneezeCooldownUntil = 0;
    let lookingRearmTimer = null;

    const isPointerEvent = (event) => Boolean(event?.type?.startsWith('pointer'));
    const getSpriteElement = () => mount.querySelector('.character-display__sprite');
    const SPRITE_MARGIN_X_RATIO = 0.18;
    const SPRITE_MARGIN_TOP_RATIO = 0.08;
    const SPRITE_MARGIN_BOTTOM_RATIO = 0.28;

    const isPointerOnCharacter = (event) => {
      if (!isPointerEvent(event)) {
        return true;
      }
      const sprite = getSpriteElement();
      if (!sprite) {
        return false;
      }
      const rect = sprite.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') {
        return true;
      }
      const insetX = rect.width * SPRITE_MARGIN_X_RATIO;
      const insetTop = rect.height * SPRITE_MARGIN_TOP_RATIO;
      const insetBottom = rect.height * SPRITE_MARGIN_BOTTOM_RATIO;
      const innerLeft = rect.left + insetX;
      const innerRight = rect.right - insetX;
      const innerTop = rect.top + insetTop;
      const innerBottom = rect.bottom - insetBottom;

      if (innerLeft >= innerRight || innerTop >= innerBottom) {
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      }

      if (clientX < innerLeft || clientX > innerRight || clientY < innerTop || clientY > innerBottom) {
        return false;
      }

      const centerX = (innerLeft + innerRight) / 2;
      const centerY = (innerTop + innerBottom) / 2;
      const radiusX = (innerRight - innerLeft) / 2;
      const radiusY = (innerBottom - innerTop) / 2;

      if (radiusX <= 0 || radiusY <= 0) {
        return true;
      }

      const normX = (clientX - centerX) / radiusX;
      const normY = (clientY - centerY) / radiusY;
      return normX * normX + normY * normY <= 1;
    };
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

        let playedVariant = false;
        if (typeof controller.playIdleVariant === 'function') {
          playedVariant = controller.playIdleVariant();
        }

        if (!playedVariant && controller.sequences?.looking?.frames?.length) {
          if (typeof controller.playLoopingState === 'function') {
            controller.playLoopingState('looking', { loops: 1, fallback: 'idle' });
          } else {
            controller.trigger('looking', { immediate: true });
          }
          playedVariant = true;
        }

        if (!playedVariant) {
          return;
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
      if (pointerInside) {
        return;
      }
      if (!isPointerOnCharacter(event)) {
        return;
      }
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
      if (pointerInside) {
        controller.hover(false);
        pointerInside = false;
      }
      controller.updateProximity(Number.POSITIVE_INFINITY);
      resetPointerTracking();
    };

    register(mount, 'pointermove', (event) => {
      if (event.pointerType !== 'touch') {
        const pointerOnCharacter = isPointerOnCharacter(event);
        if (pointerOnCharacter && !pointerInside) {
          handleHoverEnter(event);
        } else if (!pointerOnCharacter && pointerInside) {
          handleHoverLeave(event);
          return;
        }
      }

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

    const pointerRegion = mount;
    const handlePointerMove = (event) => {
      if (scheduledPointerFrame) {
        return;
      }
      scheduledPointerFrame = requestAnimationFrame(() => {
        scheduledPointerFrame = null;
        controller.notifyUserEvent();
        const pointerOnCharacter = isPointerOnCharacter(event);
        controller.updateProximity(pointerOnCharacter ? 0 : Number.POSITIVE_INFINITY);
      });
    };
    register(pointerRegion, 'pointermove', handlePointerMove, { passive: true });

    const BACKGROUND_INTERACTORS_SELECTOR =
      'button, a, input, textarea, select, label, [role="button"], [data-character], .footer-signup, .footer__social';
    const handleBackgroundClick = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (!target || !(target instanceof Element)) {
        return;
      }
      if (target.closest(BACKGROUND_INTERACTORS_SELECTOR)) {
        return;
      }
      const isPrimaryPointer = typeof event.button !== 'number' || event.button === 0;
      if (!isPrimaryPointer) {
        return;
      }
      controller.playWaveSequence({
        ensureStanding: true,
        fallback: 'idle',
        sitAfter: true,
      });
    };
    register(document, 'click', handleBackgroundClick);
  };

  if (!mobileMode) {
    setupDesktopInteractions();
  }

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
