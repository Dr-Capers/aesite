const DEFAULT_ANIMATION_FPS = 60;
const HERO_STATES = new Set(['idle', 'hover', 'spin', 'selfie']);
const BUFFER_AHEAD_MIN = 3;
const PRIORITY_FRAME_PRIMER_COUNT = 6;
const FRAME_DROP_WINDOW_MS = 4000;
const IDLE_SCHEDULER_TIMEOUT = 2000;
const IDLE_VARIANT_MIN_DELAY_MS = 2800;
const IDLE_VARIANT_MAX_DELAY_MS = 3800;
const IDLE_VARIANT_HEAVY_COOLDOWN_MS = 1200;

const DEFAULT_STATE_META = {
  idle: { priority: 0, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'idle' },
  hover: { priority: 1, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'hover' },
  looking: { priority: 2, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  gum: { priority: 2, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  sitDown: { priority: 3, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idleLong' },
  idleLong: { priority: 3, fps: DEFAULT_ANIMATION_FPS, loop: true, fallback: 'idle' },
  wave: { priority: 4, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'hover' },
  sneeze: { priority: 5, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  spin: { priority: 6, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
  selfie: { priority: 7, fps: DEFAULT_ANIMATION_FPS, loop: false, fallback: 'idle' },
};

const DEFAULT_OPTIONS = {
  idleTimeoutMs: 7000,
  proximityThreshold: 160,
  alt: 'Arcade Earth mascot placeholder',
  touchMode: false,
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
  StandUP: { state: 'wave', fps: DEFAULT_ANIMATION_FPS },
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
};

const STATE_VARIANTS = {
  looking: ['gum'],
};

const IDLE_VARIANT_ROOT_STATES = ['looking'];

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
    this.stateMeta = stateMeta;
    this.idleTimeoutMs = idleTimeoutMs;
    this.proximityThreshold = proximityThreshold;
    this.alt = alt;
    this.touchMode = typeof touchMode === 'boolean' ? touchMode : detectCoarsePointer();
    this.autoCycleStates = Array.isArray(autoCycleStates) ? autoCycleStates.slice() : [];
    this.autoCycleDelayMs = autoCycleDelayMs;
    this.autoCycleOnVisibleDelayMs = autoCycleOnVisibleDelayMs;
    this.visibilityGreetingCooldownMs = visibilityGreetingCooldownMs;

    this.currentState = 'idle';
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
    this.clearTransientTimeouts();
    this.cancelBackgroundPreload();
    if (this.fpsRecoveryTimeout) {
      window.clearTimeout(this.fpsRecoveryTimeout);
      this.fpsRecoveryTimeout = null;
    }
    this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
    this.preloadedFrames.clear();
    this.frameDropHistory = [];
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
    if (!this.sequences[nextState]) {
      return;
    }
    if (this.currentState === nextState && this.frameIndex === 0) {
      if (nextState === 'idle') {
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
    } else if (nextState === 'sitDown' || nextState === 'idleLong' || nextState === 'wave') {
      this.deferIdleVariantUntilIdle = true;
      this.idleVariantCooldownUntil = Math.max(this.idleVariantCooldownUntil, now + IDLE_VARIANT_HEAVY_COOLDOWN_MS);
    } else {
      this.deferIdleVariantUntilIdle = false;
    }
    this.currentState = nextState;
    this.frameIndex = 0;
    if (resetTimer) {
      this.lastInteraction = performance.now();
    }
    this.renderFrame();
    this.scheduleBufferFill(nextState);
    if (nextState === 'idle') {
      this.scheduleIdleVariant();
    } else {
      this.clearIdleVariant();
    }
  }

  trigger(state, { immediate = false } = {}) {
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
    const wasHovering = this.hovering;
    this.hovering = isHovering;
    this.registerInteraction();

    if (isHovering) {
      if (wasHovering) {
        return;
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
      this.playLoopingState('sitDown', { loops: 1, fallback: 'idleLong' });
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
    if (this.touchMode) {
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

  scheduleIdleVariant() {
    if (typeof window === 'undefined') {
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

    const candidateStates = new Set();
    IDLE_VARIANT_ROOT_STATES.forEach((state) => {
      candidateStates.add(state);
      const variants = STATE_VARIANTS[state] ?? [];
      variants.forEach((variant) => candidateStates.add(variant));
    });

    const hasVariantFrames = Array.from(candidateStates).some((state) => {
      const frames = this.sequences[state]?.frames;
      return Array.isArray(frames) && frames.length > 0;
    });

    if (!hasVariantFrames) {
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
      this.idleVariantCooldownUntil = Math.max(
        this.idleVariantCooldownUntil,
        (typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now()) +
          IDLE_VARIANT_HEAVY_COOLDOWN_MS
      );
      this.playLoopingState('looking', { loops: 1, fallback: 'idle' });
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
    if (this.isDestroyed || !this.touchMode || !this.isVisible) {
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

  playTransientState(state, duration = 2200, { fallback } = {}) {
    if (!this.sequences[state] || !this.canInterrupt(state)) {
      return;
    }

    this.registerInteraction();
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

export function loadCharacterSequences(folderOverrides = {}) {
  const byState = {
    idle: { entries: [], priority: 0 },
    hover: { entries: [], priority: 0 },
    looking: { entries: [], priority: 0 },
    sitDown: { entries: [], priority: 0 },
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

  if (!sequences.idle.frames.length && sequences.hover.frames.length) {
    sequences.idle.frames = sequences.hover.frames.slice();
    sequences.idle.fps = sequences.hover.fps;
  }

  return sequences;
}

export const DEFAULT_STATES = DEFAULT_STATE_META;
