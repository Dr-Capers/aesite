const DEFAULT_ANIMATION_FPS = 60;
const HERO_STATES = new Set([
  'idle',
  'hover',
  'sitDown',
  'idleLong',
  'sleepIntro',
  'sleep',
  'wave',
  'standUp',
  'spin',
  'selfie',
]);

const STANDING_STATES = new Set(['hover', 'wave', 'standUp', 'spin', 'selfie', 'looking']);
const MOBILE_ALLOWED_STATES = new Set(['idle', 'idleLong']);
const MOBILE_IDLE_FPS = 28;
const BUFFER_AHEAD_MIN = 3;
const PRIORITY_FRAME_PRIMER_COUNT = 6;
const FRAME_DROP_WINDOW_MS = 4000;
const IDLE_SCHEDULER_TIMEOUT = 2000;
const IDLE_VARIANT_MIN_DELAY_MS = 5000;
const IDLE_VARIANT_MAX_DELAY_MS = 12000;
const IDLE_VARIANT_HEAVY_COOLDOWN_MS = 6000;
const FIXING_TO_SLEEP_TIMEOUT_MS = 15000;
const SLEEP_INTRO_FALLBACK_PADDING_FRAMES = 40;

const DEFAULT_STATE_META = {
  idle: { priority: 0, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'idle' },
  hover: { priority: 1, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'hover' },
  looking: { priority: 2, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  gum: { priority: 2, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  sitDown: { priority: 3, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idleLong' },
  standUp: { priority: 4, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'hover' },
  idleLong: { priority: 3, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'idle' },
  sleepIntro: { priority: 4, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'sleep' },
  sleep: { priority: 4, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'idleLong' },
  wave: { priority: 5, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'hover' },
  sneeze: { priority: 5, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  spin: { priority: 6, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  selfie: { priority: 7, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
};

const DEFAULT_OPTIONS = {
  idleTimeoutMs: 7000,
  proximityThreshold: 90,
  alt: 'Arcade Earth mascot placeholder',
  touchMode: false,
  mobileMode: false,
  autoCycleStates: ['idleLong'],
  autoCycleDelayMs: 12000,
  autoCycleOnVisibleDelayMs: 6000,
  visibilityGreetingCooldownMs: 8000,
};

function detectCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (error) {
    return false;
  }
}

const ANIMATION_MODULES = {
  ...import.meta.glob('./animations/*/*.{webp,png}', { eager: true }),
  ...import.meta.glob('../../assets/SecuenceTest/*/*.{webp,png}', { eager: true }),
};

const FOLDER_STATE_MAP = {
  Fixing: { state: 'idleLong', fps: DEFAULT_ANIMATION_FPS },
  Iddle: { state: 'hover', fps: DEFAULT_ANIMATION_FPS },
  StandUP: { state: 'standUp', fps: DEFAULT_ANIMATION_FPS },
  SitDown: { state: 'sitDown', fps: DEFAULT_ANIMATION_FPS },
  Looking: { state: 'looking', fps: DEFAULT_ANIMATION_FPS },
  Sneeze: { state: 'sneeze', fps: DEFAULT_ANIMATION_FPS },
  looking: { state: 'looking', fps: DEFAULT_ANIMATION_FPS },
  sneeze: { state: 'sneeze', fps: DEFAULT_ANIMATION_FPS },
  GUM: { state: 'gum', fps: DEFAULT_ANIMATION_FPS },
  gum: { state: 'gum', fps: DEFAULT_ANIMATION_FPS },
  Spin: { state: 'spin', fps: DEFAULT_ANIMATION_FPS },
  spin: { state: 'spin', fps: DEFAULT_ANIMATION_FPS },
  Selfie: { state: 'selfie', fps: DEFAULT_ANIMATION_FPS },
  selfie: { state: 'selfie', fps: DEFAULT_ANIMATION_FPS },
  Wave: { state: 'wave', fps: DEFAULT_ANIMATION_FPS },
  wave: { state: 'wave', fps: DEFAULT_ANIMATION_FPS },
  Sleep: { state: 'sleep', fps: DEFAULT_ANIMATION_FPS },
  sleep: { state: 'sleep', fps: DEFAULT_ANIMATION_FPS },
};

const STATE_VARIANTS = {};

const IDLE_VARIANT_STATES = ['looking', 'gum', 'selfie', 'spin'];

const GLOBAL_PRELOAD_CACHE = new Map();
const GLOBAL_PRELOAD_IDLE_HANDLES = new Set();

function scheduleGlobalIdlePreload(callback) {
  if (typeof window === 'undefined') {
    callback();
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const handleObj = { type: 'idle', handle: null };
    handleObj.handle = window.requestIdleCallback(
      () => {
        GLOBAL_PRELOAD_IDLE_HANDLES.delete(handleObj);
        callback();
      },
      { timeout: IDLE_SCHEDULER_TIMEOUT }
    );
    GLOBAL_PRELOAD_IDLE_HANDLES.add(handleObj);
    return;
  }

  const handleObj = { type: 'timeout', handle: null };
  handleObj.handle = window.setTimeout(() => {
    GLOBAL_PRELOAD_IDLE_HANDLES.delete(handleObj);
    callback();
  }, 32);
  GLOBAL_PRELOAD_IDLE_HANDLES.add(handleObj);
}

function ensureGlobalPreloadRecord(src, { highPriority = false } = {}) {
  if (!src || typeof window === 'undefined') {
    return null;
  }

  const existing = GLOBAL_PRELOAD_CACHE.get(src);
  if (existing) {
    if (highPriority && existing.image && 'fetchPriority' in existing.image) {
      existing.image.fetchPriority = 'high';
    }
    return existing;
  }

  const image = new Image();
  if (highPriority && 'fetchPriority' in image) {
    image.fetchPriority = 'high';
  }
  if ('decoding' in image) {
    image.decoding = highPriority ? 'sync' : 'async';
  }

  const record = { image, ready: false, error: false, promise: null };
  let resolved = false;

  const finalize = (error = false) => {
    if (resolved) {
      return record;
    }
    resolved = true;
    record.ready = !error;
    record.error = error;
    return record;
  };

  const promise = new Promise((resolve) => {
    const fulfill = (error = false) => resolve(finalize(error));
    image.addEventListener(
      'load',
      () => {
        if (typeof image.decode === 'function') {
          image
            .decode()
            .then(() => fulfill(false))
            .catch(() => fulfill(false));
        } else {
          fulfill(false);
        }
      },
      { once: true }
    );
    image.addEventListener('error', () => fulfill(true), { once: true });
  });

  record.promise = promise;
  GLOBAL_PRELOAD_CACHE.set(src, record);
  image.src = src;

  return record;
}

/**
 * Simple state-driven sprite animator intended to be swapped with real frame data later.
 */
export class CharacterController {
  constructor({
    mount,
    sequences,
    stateMeta = DEFAULT_STATE_META,
    idleTimeoutMs = DEFAULT_OPTIONS.idleTimeoutMs,
    proximityThreshold = DEFAULT_OPTIONS.proximityThreshold,
    alt = DEFAULT_OPTIONS.alt,
    touchMode = null,
    mobileMode = DEFAULT_OPTIONS.mobileMode,
    autoCycleStates = DEFAULT_OPTIONS.autoCycleStates,
    autoCycleDelayMs = DEFAULT_OPTIONS.autoCycleDelayMs,
    autoCycleOnVisibleDelayMs = DEFAULT_OPTIONS.autoCycleOnVisibleDelayMs,
    visibilityGreetingCooldownMs = DEFAULT_OPTIONS.visibilityGreetingCooldownMs,
  }) {
    if (!mount) {
      throw new Error('CharacterController requires a mount element');
    }

    this.mount = mount;
    this.sequences = sequences;
    this.stateMeta = Object.fromEntries(
      Object.entries(stateMeta || {}).map(([key, meta]) => [key, { ...meta }])
    );
    this.idleTimeoutMs = idleTimeoutMs;
    this.proximityThreshold = proximityThreshold;
    this.alt = alt;
    this.touchMode = typeof touchMode === 'boolean' ? touchMode : detectCoarsePointer();
    this.mobileModeLocked = typeof mobileMode === 'boolean';
    this.mobileMode = this.mobileModeLocked
      ? Boolean(mobileMode)
      : Boolean(this.touchMode);
    this.autoCycleStates = Array.isArray(autoCycleStates) ? autoCycleStates.slice() : [];
    this.autoCycleDelayMs = autoCycleDelayMs;
    this.autoCycleOnVisibleDelayMs = autoCycleOnVisibleDelayMs;
    this.visibilityGreetingCooldownMs = visibilityGreetingCooldownMs;

    if (this.mobileMode) {
      this.autoCycleStates = [];
      MOBILE_ALLOWED_STATES.forEach((state) => {
        if (!this.stateMeta[state]) {
          this.stateMeta[state] = { priority: 0, fps: MOBILE_IDLE_FPS, loop: true, fallback: 'idle' };
        } else {
          this.stateMeta[state] = { ...this.stateMeta[state], fps: MOBILE_IDLE_FPS };
        }
        if (this.sequences[state]) {
          this.sequences[state].fps = MOBILE_IDLE_FPS;
        }
      });
    }

    const hasSitDown = Array.isArray(this.sequences.sitDown?.frames) && this.sequences.sitDown.frames.length > 0;
    const hasFixing = Array.isArray(this.sequences.idleLong?.frames) && this.sequences.idleLong.frames.length > 0;
    const hasIdle = Array.isArray(this.sequences.idle?.frames) && this.sequences.idle.frames.length > 0;
    if (this.mobileMode && hasFixing) {
      this.currentState = 'idleLong';
    } else if (hasSitDown) {
      this.currentState = 'sitDown';
    } else if (hasIdle) {
      this.currentState = 'idle';
    } else {
      this.currentState = 'hover';
    }
    if (this.mount?.dataset) {
      this.mount.dataset.characterState = this.currentState;
    }
    this.frameIndex = 0;
    this.pendingState = null;
    this.lastFrameTime = 0;
    this.lastInteraction = performance.now();
    this.hovering = false;
    this.proximityActive = false;
    this.rafId = null;
    this.isDestroyed = false;
    this.isVisible = false;
    this.autoCycleTimer = null;
    this.idleVariantTimer = null;
    this.deferIdleVariantUntilIdle = false;
    this.idleVariantCooldownUntil = 0;
    this.lastIdleVariantState = null;
    this.autoCycleIndex = 0;
    this.transientTimeouts = new Set();
    this.lastVisibilityGreeting = 0;
    this.preloadedFrames = new Map();
    this.frameDropHistory = [];
    this.dynamicFpsScale = 1;
    this.fpsRecoveryTimeout = null;
    this.performanceMarksEnabled =
      typeof performance !== 'undefined' && typeof performance.mark === 'function';
    this.backgroundPreloadHandles = new Set();

    this.image = document.createElement('img');
    this.image.className = 'character-display__sprite';
    if ('decoding' in this.image) {
      this.image.decoding = 'sync';
    }
    this.image.alt = alt;
    this.mount.appendChild(this.image);

    this.loop = this.loop.bind(this);

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.shouldReduceMotion = this.reducedMotionQuery.matches;

    this.onReducedMotionChange = (event) => {
      this.shouldReduceMotion = event.matches;
      if (this.shouldReduceMotion) {
        this.stop();
        this.renderFrame();
        this.clearIdleVariant();
      } else {
        this.start();
        if (this.currentState === 'idle') {
          this.scheduleIdleVariant();
        }
      }
    };
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);

    this.autoCycleStates = this.autoCycleStates.filter((state) => Boolean(this.sequences[state]));

    this.waveFallbackOverride = null;
    this.standUpFallbackOverride = null;
    this.sleepTimer = null;

    this.readyPromise = this.preloadSequences(this.sequences)
      .catch((error) => {
        console.error('Character preload failed', error);
        return null;
      })
      .finally(() => {
        if (this.isDestroyed) {
          return;
        }
        this.scheduleBufferFill(this.currentState);
        this.renderFrame(true);
        this.start();
      });

    if (this.shouldReduceMotion) {
      this.readyPromise.then(() => {
        if (!this.isDestroyed) {
          this.renderFrame(true);
        }
      });
    }
  }

  start() {
    if (this.shouldReduceMotion || this.rafId !== null) {
      return;
    }
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  ready() {
    return this.readyPromise ?? Promise.resolve();
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
    this.isDestroyed = true;
    this.clearAutoCycle();
    this.clearIdleVariant();
    this.deferIdleVariantUntilIdle = false;
    this.idleVariantCooldownUntil = 0;
    this.lastIdleVariantState = null;
    this.clearTransientTimeouts();
    this.cancelBackgroundPreload();
    if (this.fpsRecoveryTimeout) {
      window.clearTimeout(this.fpsRecoveryTimeout);
      this.fpsRecoveryTimeout = null;
    }
    this.cancelSleepTimer();
    this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
    this.preloadedFrames.clear();
    this.frameDropHistory = [];
    if (this.mount?.dataset) {
      delete this.mount.dataset.characterState;
    }
    this.mount.replaceChildren();
  }

  loop(timestamp) {
    if (this.isDestroyed) {
      return;
    }

    let meta = this.getMetaForState(this.currentState);
    let sequence = this.getSequence(this.currentState);

    if (!sequence) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const baseFps = meta?.fps ?? sequence.fps ?? DEFAULT_ANIMATION_FPS;
    const effectiveFps = Math.max(1, baseFps * this.dynamicFpsScale);
    const frameInterval = 1000 / effectiveFps;
    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed >= frameInterval) {
      const frameCount = sequence.frames.length;
      if (frameCount > 0) {
        const nextIndex = (this.frameIndex + 1) % frameCount;
        const nextFrame = sequence.frames[nextIndex];

        if (nextFrame && !this.isFrameReady(nextFrame)) {
          this.scheduleBufferFill(this.currentState);
          this.handleFrameStall(timestamp, frameInterval);
        } else {
          this.frameIndex += 1;
          if (this.frameIndex >= frameCount) {
            if (meta?.loop) {
              this.frameIndex = 0;
            } else {
              this.handleSequenceComplete();
              meta = this.getMetaForState(this.currentState);
              sequence = this.getSequence(this.currentState);
              if (!sequence) {
                this.lastFrameTime = timestamp;
                this.evaluateState(timestamp);
                this.rafId = requestAnimationFrame(this.loop);
                return;
              }
            }
          }
          this.renderFrame();
          if (elapsed > frameInterval * 1.5) {
            this.recordFrameDrop(elapsed, frameInterval);
          } else {
            this.resetFpsScaling();
          }
          this.lastFrameTime = timestamp;
          this.scheduleBufferFill(this.currentState);
        }
      }
    }

    this.evaluateState(timestamp);

    this.rafId = requestAnimationFrame(this.loop);
  }

  renderFrame(force = false) {
    const sequence = this.getSequence(this.currentState);
    if (!sequence || sequence.frames.length === 0) {
      return;
    }
    const frame = sequence.frames[this.frameIndex % sequence.frames.length];
    if (!frame) {
      return;
    }

    const record = this.preloadedFrames.get(frame);
    const preloadedImage = record?.image ?? (record instanceof Image ? record : null);
    const preferredSrc = preloadedImage?.currentSrc || preloadedImage?.src || frame;
    const isReady = Boolean(record?.ready || preloadedImage?.complete);

    if (isReady && preloadedImage) {
      if (force || this.image.src !== preferredSrc) {
        this.image.src = preferredSrc;
      }
      return;
    }

    if (force || this.image.src !== frame) {
      this.image.src = frame;
    }
  }

  handleSequenceComplete() {
    if (this.currentState === 'wave' && this.waveFallbackOverride) {
      const next = this.waveFallbackOverride;
      this.waveFallbackOverride = null;
      if (this.sequences[next]) {
        this.setState(next, { resetTimer: false });
        return;
      }
    }
    if (this.currentState === 'standUp' && this.standUpFallbackOverride) {
      const next = this.standUpFallbackOverride;
      this.standUpFallbackOverride = null;
      if (this.sequences[next]) {
        this.setState(next, { resetTimer: false });
        return;
      }
    }
    const meta = this.getMetaForState(this.currentState);
    const fallback = meta?.fallback ?? 'idle';
    this.setState(fallback, { resetTimer: false });
  }

  evaluateState(timestamp) {
    if (this.pendingState) {
      const next = this.pendingState;
      if (this.canInterrupt(next)) {
        this.pendingState = null;
        this.setState(next, { resetTimer: false });
        return;
      } else {
        this.pendingState = next;
      }
    }

  }

  setState(nextState, { resetTimer = true } = {}) {
    if (this.mobileMode && !MOBILE_ALLOWED_STATES.has(nextState)) {
      return;
    }
    const sequence = this.getSequence(nextState);
    if (!sequence?.frames?.length) {
      return;
    }
    if (this.currentState === nextState && this.frameIndex === 0) {
      if (nextState === 'idle' && !this.mobileMode) {
        this.deferIdleVariantUntilIdle = false;
        this.scheduleIdleVariant();
      } else {
        this.clearIdleVariant();
      }
      return;
    }
    const now = typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now();
    if (nextState === 'idle') {
      this.deferIdleVariantUntilIdle = false;
    } else if (
      nextState === 'sitDown' ||
      nextState === 'idleLong' ||
      nextState === 'sleepIntro' ||
      nextState === 'wave' ||
      nextState === 'sleep'
    ) {
      this.deferIdleVariantUntilIdle = true;
      this.idleVariantCooldownUntil = Math.max(this.idleVariantCooldownUntil, now + IDLE_VARIANT_HEAVY_COOLDOWN_MS);
    } else {
      this.deferIdleVariantUntilIdle = false;
    }
    this.cancelSleepTimer();
    if (this.currentState === 'wave' && nextState !== 'wave') {
      this.waveFallbackOverride = null;
    }
    if (this.currentState === 'standUp' && nextState !== 'standUp') {
      this.standUpFallbackOverride = null;
    }
    this.currentState = nextState;
    if (this.mount?.dataset) {
      this.mount.dataset.characterState = this.currentState;
    }
    this.frameIndex = 0;
    if (sequence.frames.length) {
      const firstFrame = sequence.frames[0];
      if (!this.isFrameReady(firstFrame)) {
        this.preloadFrame(firstFrame, { highPriority: true });
      }
    }
    if (resetTimer) {
      this.lastInteraction = performance.now();
    }
    this.renderFrame();
    this.scheduleBufferFill(nextState);
    if (this.mobileMode) {
      this.clearIdleVariant();
      return;
    }
    this.scheduleFixingSleepTimerIfNeeded();
    if (nextState === 'idle') {
      this.scheduleIdleVariant();
    } else {
      this.clearIdleVariant();
    }
  }

  scheduleFixingSleepTimerIfNeeded() {
    if (typeof window === 'undefined' || this.mobileMode) {
      return;
    }
    this.cancelSleepTimer();
    if (
      this.isDestroyed ||
      this.currentState !== 'idleLong' ||
      !this.getSequence('sleep')?.frames?.length
    ) {
      return;
    }
    this.sleepTimer = window.setTimeout(() => {
      this.sleepTimer = null;
      if (this.isDestroyed || this.currentState !== 'idleLong') {
        return;
      }
      if (!this.canInterrupt('sleep')) {
        this.scheduleFixingSleepTimerIfNeeded();
        return;
      }
      this.playSleepSequence();
    }, FIXING_TO_SLEEP_TIMEOUT_MS);
  }

  cancelSleepTimer() {
    if (typeof window === 'undefined') {
      this.sleepTimer = null;
      return;
    }
    if (this.sleepTimer !== null) {
      window.clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  trigger(state, { immediate = false } = {}) {
    if (this.mobileMode) {
      return;
    }
    this.registerInteraction();
    const selectedState = this.resolveVariant(state);
    if (immediate && this.canInterrupt(selectedState)) {
      this.setState(selectedState);
    } else if (
      !this.pendingState ||
      this.getPriority(selectedState) > this.getPriority(this.pendingState)
    ) {
      this.pendingState = selectedState;
    }
  }

  hover(isHovering) {
    if (this.mobileMode) {
      return;
    }
    const wasHovering = this.hovering;
    this.hovering = isHovering;
    this.registerInteraction();

    if (isHovering) {
      if (wasHovering) {
        return;
      }

      if (!this.isStandingState(this.currentState)) {
        const standUpSequence = this.getSequence('standUp');
        if (standUpSequence?.frames?.length && this.canInterrupt('standUp')) {
          const hoverAvailable = this.getSequence('hover')?.frames?.length;
          const idleLongAvailable = this.getSequence('idleLong')?.frames?.length;
          const fallbackState = hoverAvailable ? 'hover' : idleLongAvailable ? 'idleLong' : 'idle';
          const duration = this.getLinearSequenceDuration('standUp');
          this.playTransientState('standUp', duration, {
            fallback: fallbackState,
          });
          return;
        }
      }

      if (this.isStandingState(this.currentState)) {
        const sneezeSequence = this.getSequence('sneeze');
        if (sneezeSequence?.frames?.length) {
          this.playLoopingState('sneeze', { loops: 1, fallback: 'idle' });
          return;
        }
      }

      if (this.sequences.wave) {
        this.trigger('wave', { immediate: true });
      } else {
        this.trigger('hover', { immediate: true });
      }
      return;
    }

    if (!wasHovering) {
      return;
    }

    const sitDownSequence = this.getSequence('sitDown');
    if (sitDownSequence?.frames?.length) {
      this.pendingState = null;
      this.waveFallbackOverride = null;
      this.standUpFallbackOverride = null;
      this.setState('sitDown', { resetTimer: false });
      return;
    }

    const idleLongSequence = this.getSequence('idleLong');
    if (idleLongSequence?.frames?.length) {
      this.trigger('idleLong', { immediate: true });
    } else {
      this.trigger('idle', { immediate: true });
    }
  }

  updateProximity(distance) {
    if (this.mobileMode) {
      return;
    }
    if (typeof distance !== 'number' || Number.isNaN(distance)) {
      return;
    }
    const wasActive = this.proximityActive;
    this.proximityActive = distance <= this.proximityThreshold;
    if (
      this.proximityActive &&
      !wasActive &&
      !this.hovering &&
      this.pendingState !== 'idleLong' &&
      this.currentState !== 'idleLong'
    ) {
      this.trigger('wave', { immediate: true });
    }
  }

  registerInteraction() {
    this.lastInteraction = performance.now();
    if (this.touchMode && !this.mobileMode) {
      if (this.isVisible) {
        this.scheduleAutoCycle();
      } else {
        this.clearAutoCycle();
      }
    }
  }

  notifyUserEvent() {
    this.registerInteraction();
  }

  canInterrupt(nextState) {
    const currentPriority = this.getPriority(this.currentState);
    const nextPriority = this.getPriority(nextState);
    return nextPriority >= currentPriority;
  }

  getPriority(state) {
    return this.getMetaForState(state)?.priority ?? 0;
  }

  getSequence(state) {
    return this.sequences[state] ?? null;
  }

  getMetaForState(state) {
    return this.stateMeta[state] ?? null;
  }

  setTouchMode(value) {
    const next = Boolean(value);
    if (this.touchMode === next) {
      return;
    }
    this.touchMode = next;
    if (!this.mobileModeLocked) {
      this.mobileMode = next;
    }
    if (this.mobileMode) {
      this.clearAutoCycle();
      return;
    }
    if (this.touchMode && this.isVisible) {
      this.scheduleAutoCycle();
    } else {
      this.clearAutoCycle();
    }
  }

  setVisibility(isVisible) {
    if (this.isVisible === isVisible) {
      return;
    }
    this.isVisible = isVisible;
    if (!isVisible) {
      this.clearAutoCycle();
      this.clearIdleVariant();
      return;
    }

    if (this.mobileMode) {
      this.clearIdleVariant();
      return;
    }

    if (this.currentState === 'idle') {
      this.scheduleIdleVariant();
    }

    if (this.touchMode) {
      const now = performance.now();
      if (now - this.lastVisibilityGreeting > this.visibilityGreetingCooldownMs) {
        this.lastVisibilityGreeting = now;
        if (this.sequences.wave) {
          this.trigger('wave', { immediate: true });
        }
      }
      this.scheduleAutoCycle(this.autoCycleOnVisibleDelayMs);
    }
  }

  scheduleAutoCycle(delay = this.autoCycleDelayMs) {
    if (this.mobileMode) {
      this.clearAutoCycle();
      return;
    }
    this.clearAutoCycle();
    if (!this.touchMode || !this.isVisible || !this.autoCycleStates.length) {
      return;
    }
    this.autoCycleTimer = window.setTimeout(() => {
      this.autoCycleTimer = null;
      this.handleAutoCycleTick();
    }, Math.max(0, delay));
  }

  clearAutoCycle() {
    if (this.autoCycleTimer !== null) {
      window.clearTimeout(this.autoCycleTimer);
      this.autoCycleTimer = null;
    }
  }

  getIdleVariantPool() {
    if (this.mobileMode) {
      return [];
    }
    return IDLE_VARIANT_STATES.filter((state) => {
      const frames = this.sequences[state]?.frames;
      return Array.isArray(frames) && frames.length > 0;
    });
  }

  pickIdleVariant(pool) {
    if (!Array.isArray(pool) || pool.length === 0) {
      return null;
    }
    let options = pool;
    if (options.length > 1 && this.lastIdleVariantState && options.includes(this.lastIdleVariantState)) {
      const filtered = options.filter((state) => state !== this.lastIdleVariantState);
      if (filtered.length) {
        options = filtered;
      }
    }
    const index = Math.floor(Math.random() * options.length);
    return options[index] ?? null;
  }

  executeIdleVariant() {
    if (this.mobileMode) {
      return false;
    }
    const pool = this.getIdleVariantPool();
    if (!pool.length) {
      return false;
    }

    const nextState = this.pickIdleVariant(pool);
    if (!nextState) {
      return false;
    }

    const now = typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now();
    this.idleVariantCooldownUntil = Math.max(this.idleVariantCooldownUntil, now + IDLE_VARIANT_HEAVY_COOLDOWN_MS);
    this.lastIdleVariantState = nextState;
    this.playLoopingState(nextState, { loops: 1, fallback: 'idle' });
    return true;
  }

  playIdleVariant() {
    if (
      this.isDestroyed ||
      !this.isVisible ||
      this.shouldReduceMotion ||
      this.deferIdleVariantUntilIdle ||
      this.mobileMode
    ) {
      return false;
    }

    this.clearIdleVariant();
    return this.executeIdleVariant();
  }

  scheduleIdleVariant() {
    if (typeof window === 'undefined' || this.mobileMode) {
      return;
    }

    this.clearIdleVariant();

    if (
      this.isDestroyed ||
      this.currentState !== 'idle' ||
      !this.isVisible ||
      this.shouldReduceMotion ||
      this.deferIdleVariantUntilIdle
    ) {
      return;
    }

    if (!this.getIdleVariantPool().length) {
      return;
    }

    const now = typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now();
    const delayRange = Math.max(0, IDLE_VARIANT_MAX_DELAY_MS - IDLE_VARIANT_MIN_DELAY_MS);
    let delay = IDLE_VARIANT_MIN_DELAY_MS + Math.random() * delayRange;
    if (this.idleVariantCooldownUntil > now) {
      delay += this.idleVariantCooldownUntil - now;
    }

    this.idleVariantTimer = window.setTimeout(() => {
      this.idleVariantTimer = null;
      if (
        this.isDestroyed ||
        this.currentState !== 'idle' ||
        !this.isVisible ||
        this.shouldReduceMotion ||
        this.deferIdleVariantUntilIdle
      ) {
        return;
      }
      this.executeIdleVariant();
    }, delay);
  }

  clearIdleVariant() {
    if (typeof window === 'undefined') {
      this.idleVariantTimer = null;
      return;
    }
    if (this.idleVariantTimer !== null) {
      window.clearTimeout(this.idleVariantTimer);
      this.idleVariantTimer = null;
    }
  }

  handleAutoCycleTick() {
    if (this.isDestroyed || !this.touchMode || !this.isVisible || this.mobileMode) {
      return;
    }

    const nextState = this.pickNextAutoState();
    if (!nextState) {
      this.scheduleAutoCycle();
      return;
    }

    if (!this.canInterrupt(nextState)) {
      this.scheduleAutoCycle(Math.max(4000, this.autoCycleDelayMs * 0.75));
      return;
    }

    const meta = this.getMetaForState(nextState);
    if (meta?.loop) {
      this.playTransientState(nextState);
    } else {
      this.trigger(nextState, { immediate: true });
    }

    this.scheduleAutoCycle();
  }

  pickNextAutoState() {
    if (!this.autoCycleStates.length) {
      return null;
    }

    const available = this.autoCycleStates.filter((state) => Boolean(this.sequences[state]));
    if (!available.length) {
      return null;
    }

    const index = this.autoCycleIndex % available.length;
    let next = available[index];
    this.autoCycleIndex = (this.autoCycleIndex + 1) % available.length;

    if (next === this.currentState && available.length > 1) {
      next = available[this.autoCycleIndex];
      this.autoCycleIndex = (this.autoCycleIndex + 1) % available.length;
    }

    return next;
  }

  playLoopingState(state, { loops = 1, fallback } = {}) {
    if (this.mobileMode && !MOBILE_ALLOWED_STATES.has(state)) {
      return;
    }
    const selectedState = this.resolveVariant(state);
    const sequence = this.getSequence(selectedState);
    if (!sequence || sequence.frames.length === 0) {
      return;
    }

    const meta = this.getMetaForState(selectedState);
    const fps = meta?.fps ?? sequence.fps ?? DEFAULT_ANIMATION_FPS;
    const duration = (loops * sequence.frames.length * 1000) / Math.max(fps, 1);
    const shouldForceTimeout = Boolean(meta?.loop);
    const transientDuration = shouldForceTimeout ? duration + 120 : null;
    this.playTransientState(selectedState, transientDuration, { fallback });
  }

  resolveVariant(state) {
    const variants = STATE_VARIANTS[state];
    if (!variants?.length) {
      return state;
    }

    const availableVariants = variants.filter((candidate) => {
      const frames = this.sequences[candidate]?.frames;
      return Array.isArray(frames) && frames.length > 0;
    });

    if (!availableVariants.length) {
      return state;
    }

    const choices = [state, ...availableVariants];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  isStandingState(state) {
    return STANDING_STATES.has(state);
  }

  playWaveSequence({ ensureStanding = false, fallback = 'idle', sitAfter = false } = {}) {
    if (this.mobileMode) {
      return false;
    }
    const waveSequence = this.getSequence('wave');
    if (!waveSequence?.frames?.length) {
      return false;
    }

    const finalFallback =
      sitAfter && this.getSequence('sitDown')?.frames?.length ? 'sitDown' : fallback;

    this.waveFallbackOverride = finalFallback && this.sequences[finalFallback] ? finalFallback : null;

    if (
      ensureStanding &&
      !this.isStandingState(this.currentState) &&
      this.getSequence('standUp')?.frames?.length &&
      this.canInterrupt('standUp')
    ) {
      this.standUpFallbackOverride = this.sequences.wave ? 'wave' : null;
      const duration = this.getLinearSequenceDuration('standUp');
      this.playTransientState('standUp', duration, { fallback: this.standUpFallbackOverride || 'hover' });
      return true;
    }

    if (
      ensureStanding &&
      !this.isStandingState(this.currentState) &&
      this.getSequence('hover')?.frames?.length &&
      this.canInterrupt('hover')
    ) {
      this.playLoopingState('hover', { loops: 1, fallback: 'wave' });
      return true;
    }

    this.trigger('wave', { immediate: true });
    return true;
  }

  getLinearSequenceDuration(state) {
    const sequence = this.getSequence(state);
    if (!sequence?.frames?.length) {
      return 0;
    }
    const meta = this.getMetaForState(state);
    const fps = meta?.fps ?? sequence.fps ?? DEFAULT_ANIMATION_FPS;
    return (sequence.frames.length * 1000) / Math.max(fps, 1);
  }

  playSleepSequence() {
    if (this.mobileMode) {
      return false;
    }
    const intro = this.getSequence('sleepIntro');
    if (intro?.frames?.length) {
      const introMeta = this.getMetaForState('sleepIntro');
      const introFps = introMeta?.fps ?? intro.fps ?? DEFAULT_ANIMATION_FPS;
      const framePaddingMs = (SLEEP_INTRO_FALLBACK_PADDING_FRAMES * 1000) / Math.max(introFps, 1);
      const duration = this.getLinearSequenceDuration('sleepIntro') + framePaddingMs;
      this.playTransientState('sleepIntro', duration, { fallback: 'sleep' });
      return true;
    }
    if (this.getSequence('sleep')?.frames?.length) {
      this.trigger('sleep', { immediate: true });
      return true;
    }
    return false;
  }

  playTransientState(state, duration = 2200, { fallback } = {}) {
    if (
      (this.mobileMode && !MOBILE_ALLOWED_STATES.has(state)) ||
      !this.sequences[state] ||
      !this.canInterrupt(state)
    ) {
      return;
    }

    this.registerInteraction();
    this.preloadStateFrames(state, { highPriority: true });
    this.setState(state, { resetTimer: false });

    if (Number.isFinite(duration) && duration > 0) {
      const timeoutId = window.setTimeout(() => {
        this.transientTimeouts.delete(timeoutId);
        if (this.currentState === state) {
          const nextFallback = fallback ?? this.getMetaForState(state)?.fallback ?? 'idle';
          this.trigger(nextFallback, { immediate: true });
        }
      }, Math.max(1000, duration));

      this.transientTimeouts.add(timeoutId);
    }
  }

  clearTransientTimeouts() {
    this.transientTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.transientTimeouts.clear();
  }

  scheduleBufferFill(state) {
    if (!state || typeof window === 'undefined') {
      return;
    }

    const sequence = this.sequences[state];
    if (!sequence?.frames?.length) {
      return;
    }

    const frameCount = sequence.frames.length;
    const startIndex = state === this.currentState ? this.frameIndex : 0;

    for (let offset = 0; offset <= BUFFER_AHEAD_MIN; offset += 1) {
      const index = (startIndex + offset) % frameCount;
      const src = sequence.frames[index];
      if (!src || this.isFrameReady(src)) {
        continue;
      }
      const highPriority = state === this.currentState && offset <= 1;
      if (highPriority) {
        this.preloadFrame(src, { highPriority: true });
      } else {
        this.scheduleIdleTask(() => this.preloadFrame(src));
      }
    }
  }

  isFrameReady(src) {
    const record = this.preloadedFrames.get(src);
    if (!record) {
      return false;
    }
    if (record?.ready && record.image) {
      return true;
    }
    if (record instanceof Image) {
      return record.complete;
    }
    const image = record?.image;
    return Boolean(image?.complete);
  }

  handleFrameStall(timestamp, frameInterval) {
    this.recordFrameDrop(timestamp - this.lastFrameTime, frameInterval);
    this.dynamicFpsScale = Math.max(0.5, this.dynamicFpsScale * 0.85);
    this.lastFrameTime = timestamp - frameInterval * 0.5;
    if (this.fpsRecoveryTimeout) {
      window.clearTimeout(this.fpsRecoveryTimeout);
    }
    this.fpsRecoveryTimeout = window.setTimeout(() => this.resetFpsScaling(), FRAME_DROP_WINDOW_MS);
  }

  resetFpsScaling() {
    if (this.dynamicFpsScale === 1) {
      return;
    }
    this.dynamicFpsScale = 1;
    if (this.fpsRecoveryTimeout) {
      window.clearTimeout(this.fpsRecoveryTimeout);
      this.fpsRecoveryTimeout = null;
    }
  }

  recordFrameDrop(elapsed, expected) {
    if (!Number.isFinite(elapsed) || !Number.isFinite(expected)) {
      return;
    }
    const now = performance.now();
    this.frameDropHistory.push({ timestamp: now, elapsed, expected });
    this.frameDropHistory = this.frameDropHistory.filter(
      (entry) => now - entry.timestamp <= FRAME_DROP_WINDOW_MS
    );
    if (this.performanceMarksEnabled) {
      performance.mark(`character-frame-drop-${Math.round(now)}`);
    }
  }

  async preloadSequences(sequences) {
    if (!sequences || typeof window === 'undefined') {
      return;
    }

    const heroStates = Array.from(HERO_STATES).filter((state) =>
      Array.isArray(sequences[state]?.frames) && sequences[state].frames.length > 0
    );

    const primerPromises = heroStates.map((state) =>
      this.preloadStateFrames(state, {
        limit: PRIORITY_FRAME_PRIMER_COUNT,
        highPriority: true,
      })
    );

    await Promise.all(primerPromises);

    const heroRemainderPromises = heroStates.map((state) =>
      this.preloadStateFrames(state, { highPriority: true })
    );

    const remainingStates = Object.keys(sequences).filter(
      (state) =>
        !HERO_STATES.has(state) &&
        Array.isArray(sequences[state]?.frames) &&
        sequences[state].frames.length > 0
    );

    remainingStates.forEach((state) => {
      this.scheduleIdleTask(() => this.preloadStateFrames(state));
    });

    await Promise.all(heroRemainderPromises);
  }

  preloadStateFrames(state, { limit, highPriority } = {}) {
    if (this.isDestroyed) {
      return Promise.resolve();
    }
    const sequence = this.sequences[state];
    const frames = sequence?.frames;
    if (!Array.isArray(frames) || !frames.length) {
      return Promise.resolve();
    }

    const slice = typeof limit === 'number' ? frames.slice(0, limit) : frames;
    if (!slice.length) {
      return Promise.resolve();
    }

    const promises = slice.map((src) => this.preloadFrame(src, { highPriority }));
    return Promise.all(promises);
  }

  preloadFrame(src, { highPriority = false } = {}) {
    if (!src || typeof window === 'undefined' || this.isDestroyed) {
      return Promise.resolve(null);
    }

    const existing = this.preloadedFrames.get(src);
    if (existing?.ready) {
      return Promise.resolve(existing);
    }
    if (existing?.promise) {
      return existing.promise;
    }
    const globalRecord = ensureGlobalPreloadRecord(src, { highPriority });
    if (!globalRecord) {
      return Promise.resolve(null);
    }

    this.preloadedFrames.set(src, globalRecord);

    if (globalRecord.ready) {
      return Promise.resolve(globalRecord);
    }

    if (globalRecord.promise) {
      return globalRecord.promise.then(() => globalRecord);
    }

    return Promise.resolve(globalRecord);
  }

  scheduleIdleTask(callback) {
    if (typeof window === 'undefined') {
      callback();
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      const handleObj = { type: 'idle', handle: null };
      handleObj.handle = window.requestIdleCallback(
        () => {
          this.backgroundPreloadHandles.delete(handleObj);
          if (this.isDestroyed) {
            return;
          }
          callback();
        },
        { timeout: IDLE_SCHEDULER_TIMEOUT }
      );
      this.backgroundPreloadHandles.add(handleObj);
      return;
    }

    const handleObj = { type: 'timeout', handle: null };
    handleObj.handle = window.setTimeout(() => {
      this.backgroundPreloadHandles.delete(handleObj);
      if (this.isDestroyed) {
        return;
      }
      callback();
    }, 32);
    this.backgroundPreloadHandles.add(handleObj);
  }

  cancelBackgroundPreload() {
    if (!this.backgroundPreloadHandles) {
      return;
    }
    this.backgroundPreloadHandles.forEach((entry) => {
      if (entry.type === 'idle' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(entry.handle);
      }
      if (entry.type === 'timeout') {
        window.clearTimeout(entry.handle);
      }
    });
    this.backgroundPreloadHandles.clear();
  }
}

export function primeCharacterAssets(sequences = loadCharacterSequences()) {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const heroPromises = [];

  HERO_STATES.forEach((state) => {
    const frames = sequences?.[state]?.frames;
    if (!Array.isArray(frames) || !frames.length) {
      return;
    }
    frames.forEach((src, index) => {
      if (!src) {
        return;
      }
      const record = ensureGlobalPreloadRecord(src, {
        highPriority: index < PRIORITY_FRAME_PRIMER_COUNT,
      });
      if (record?.promise) {
        heroPromises.push(record.promise);
      }
    });
  });

  Object.keys(sequences || {})
    .filter((state) => !HERO_STATES.has(state))
    .forEach((state) => {
      const frames = sequences?.[state]?.frames;
      if (!Array.isArray(frames) || !frames.length) {
        return;
      }
      frames.forEach((src) => {
        if (!src) {
          return;
        }
        scheduleGlobalIdlePreload(() => ensureGlobalPreloadRecord(src));
      });
    });

  if (!heroPromises.length) {
    return Promise.resolve();
  }

  return Promise.allSettled(heroPromises).then(() => undefined);
}

export function loadCharacterSequences({ folderOverrides = {}, mode = 'desktop' } = {}) {
  const byState = {
    idle: { entries: [], priority: 0 },
    hover: { entries: [], priority: 0 },
    looking: { entries: [], priority: 0 },
    sitDown: { entries: [], priority: 0 },
  standUp: { entries: [], priority: 0 },
  sleepIntro: { entries: [], priority: 0 },
  sleep: { entries: [], priority: 0 },
    gum: { entries: [], priority: 0 },
    wave: { entries: [], priority: 0 },
    idleLong: { entries: [], priority: 0 },
    sneeze: { entries: [], priority: 0 },
    spin: { entries: [], priority: 0 },
    selfie: { entries: [], priority: 0 },
  };

  const sequences = {
    idle: { frames: [], fps: DEFAULT_STATE_META.idle.fps },
    hover: { frames: [], fps: DEFAULT_STATE_META.hover.fps },
    looking: { frames: [], fps: DEFAULT_STATE_META.looking.fps },
    sitDown: { frames: [], fps: DEFAULT_STATE_META.sitDown.fps },
  standUp: { frames: [], fps: DEFAULT_STATE_META.standUp.fps },
  sleepIntro: { frames: [], fps: DEFAULT_STATE_META.sleepIntro.fps },
  sleep: { frames: [], fps: DEFAULT_STATE_META.sleep.fps },
    gum: { frames: [], fps: DEFAULT_STATE_META.gum.fps },
    wave: { frames: [], fps: DEFAULT_STATE_META.wave.fps },
    idleLong: { frames: [], fps: DEFAULT_STATE_META.idleLong.fps },
    sneeze: { frames: [], fps: DEFAULT_STATE_META.sneeze.fps },
    spin: { frames: [], fps: DEFAULT_STATE_META.spin.fps },
    selfie: { frames: [], fps: DEFAULT_STATE_META.selfie.fps },
  };

  for (const [path, module] of Object.entries(ANIMATION_MODULES)) {
    const normalizedPath = String(path).replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    if (parts.length < 2) {
      continue;
    }
    const fileName = parts[parts.length - 1];
    if (!/\.(png|webp)$/i.test(fileName)) {
      continue;
    }
    const folder = parts[parts.length - 2];
    const mapping = folderOverrides[folder] ?? FOLDER_STATE_MAP[folder];
    const stateKey = typeof mapping === 'string' ? mapping : mapping?.state;
    if (!stateKey || !(stateKey in byState)) {
      continue;
    }

    const frameUrl = module?.default ?? module;
    const bucket = byState[stateKey];
    const priority = normalizedPath.includes('SecuenceTest') ? 2 : 1;
    if (priority > bucket.priority) {
      bucket.entries = [];
      bucket.priority = priority;
    }
    if (priority === bucket.priority) {
      bucket.entries.push({ path, frameUrl });
    }

    if (mapping?.fps) {
      sequences[stateKey].fps = mapping.fps;
    }
  }

  Object.entries(byState).forEach(([stateKey, bucket]) => {
    if (!bucket.entries.length) {
      return;
    }
    bucket.entries.sort((a, b) => a.path.localeCompare(b.path));
    sequences[stateKey].frames = bucket.entries.map((entry) => entry.frameUrl);
  });

  if (sequences.sleep?.frames?.length) {
    const introFrames = [];
    const loopFrames = [];
    sequences.sleep.frames.forEach((src) => {
      if (/fixtosleep/i.test(src)) {
        introFrames.push(src);
      } else {
        loopFrames.push(src);
      }
    });
    if (introFrames.length) {
      sequences.sleepIntro.frames = introFrames;
    }
    sequences.sleep.frames = loopFrames.length ? loopFrames : introFrames;
  }

  if (mode === 'mobile') {
    Object.keys(sequences).forEach((stateKey) => {
      if (!MOBILE_ALLOWED_STATES.has(stateKey)) {
        sequences[stateKey].frames = [];
      }
    });
    MOBILE_ALLOWED_STATES.forEach((stateKey) => {
      if (sequences[stateKey]) {
        sequences[stateKey].fps = MOBILE_IDLE_FPS;
      }
    });
  }

  if (!sequences.idle.frames.length) {
    if (sequences.hover.frames.length) {
      sequences.idle.frames = sequences.hover.frames.slice();
      sequences.idle.fps = sequences.hover.fps;
    } else if (sequences.idleLong.frames.length) {
      sequences.idle.frames = sequences.idleLong.frames.slice();
      sequences.idle.fps = sequences.idleLong.fps;
    }
  }

  return sequences;
}

export const DEFAULT_STATES = DEFAULT_STATE_META;
