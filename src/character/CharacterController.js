const DEFAULT_STATE_META = {
  idle: { priority: 0, fps: 30, loop: true, fallback: 'idle' },
  hover: { priority: 1, fps: 30, loop: true, fallback: 'hover' },
  idleLong: { priority: 3, fps: 30, loop: false, fallback: 'idle' },
  wave: { priority: 4, fps: 30, loop: false, fallback: 'hover' },
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

const ANIMATION_MODULES = import.meta.glob('./animations/*/*.{webp,png}', { eager: true });

const FOLDER_STATE_MAP = {
  Fixing: { state: 'idle', fps: DEFAULT_STATE_META.idle.fps },
  Iddle: { state: 'hover', fps: DEFAULT_STATE_META.hover.fps },
  StandUP: { state: 'wave', fps: DEFAULT_STATE_META.wave.fps },
  SitDown: { state: 'idleLong', fps: DEFAULT_STATE_META.idleLong.fps },
};

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
    this.autoCycleIndex = 0;
    this.transientTimeouts = new Set();
    this.lastVisibilityGreeting = 0;

    this.image = document.createElement('img');
    this.image.className = 'character-display__sprite';
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
      } else {
        this.start();
      }
    };
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);

    this.autoCycleStates = this.autoCycleStates.filter((state) => Boolean(this.sequences[state]));

    this.renderFrame();
    this.start();
  }

  start() {
    if (this.shouldReduceMotion || this.rafId !== null) {
      return;
    }
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
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
    this.clearTransientTimeouts();
    this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
    this.mount.replaceChildren();
  }

  loop(timestamp) {
    if (this.isDestroyed) {
      return;
    }

    const meta = this.getMetaForState(this.currentState);
    const sequence = this.getSequence(this.currentState);

    if (!sequence) {
      return;
    }

    const fps = meta?.fps ?? sequence.fps ?? 6;
    const frameInterval = 1000 / Math.max(fps, 1);

    if (timestamp - this.lastFrameTime >= frameInterval) {
      this.frameIndex += 1;
      if (this.frameIndex >= sequence.frames.length) {
        if (meta?.loop) {
          this.frameIndex = 0;
        } else {
          this.handleSequenceComplete();
        }
      }
      this.renderFrame();
      this.lastFrameTime = timestamp;
    }

    this.evaluateState(timestamp);

    this.rafId = requestAnimationFrame(this.loop);
  }

  renderFrame() {
    const sequence = this.getSequence(this.currentState);
    if (!sequence || sequence.frames.length === 0) {
      return;
    }
    const frame = sequence.frames[this.frameIndex % sequence.frames.length];
    if (frame && this.image.src !== frame) {
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
      return;
    }
    this.currentState = nextState;
    this.frameIndex = 0;
    if (resetTimer) {
      this.lastInteraction = performance.now();
    }
    this.renderFrame();
  }

  trigger(state, { immediate = false } = {}) {
    this.registerInteraction();
    if (immediate && this.canInterrupt(state)) {
      this.setState(state);
    } else if (!this.pendingState || this.getPriority(state) > this.getPriority(this.pendingState)) {
      this.pendingState = state;
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

    if (this.sequences.idleLong) {
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
      return;
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

  playTransientState(state, duration = 2200, { fallback } = {}) {
    if (!this.sequences[state] || !this.canInterrupt(state)) {
      return;
    }

    this.registerInteraction();
    this.setState(state, { resetTimer: false });

    const timeoutId = window.setTimeout(() => {
      this.transientTimeouts.delete(timeoutId);
      if (this.currentState === state) {
        const nextFallback = fallback ?? this.getMetaForState(state)?.fallback ?? 'idle';
        this.trigger(nextFallback, { immediate: true });
      }
    }, Math.max(1000, duration));

    this.transientTimeouts.add(timeoutId);
  }

  clearTransientTimeouts() {
    this.transientTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.transientTimeouts.clear();
  }
}

export function loadCharacterSequences(folderOverrides = {}) {
  const byState = {
    idle: [],
    hover: [],
    wave: [],
    idleLong: [],
  };

  const sequences = {
    idle: { frames: [], fps: DEFAULT_STATE_META.idle.fps },
    hover: { frames: [], fps: DEFAULT_STATE_META.hover.fps },
    wave: { frames: [], fps: DEFAULT_STATE_META.wave.fps },
    idleLong: { frames: [], fps: DEFAULT_STATE_META.idleLong.fps },
  };

  for (const [path, module] of Object.entries(ANIMATION_MODULES)) {
    const match = path.match(/animations\/(.*?)\/(.*?)\.(png|webp)$/);
    if (!match) {
      continue;
    }
    const folder = match[1];
    const mapping = folderOverrides[folder] ?? FOLDER_STATE_MAP[folder];
    const stateKey = typeof mapping === 'string' ? mapping : mapping?.state;
    if (!stateKey || !(stateKey in byState)) {
      continue;
    }

    const frameUrl = module?.default ?? module;
    byState[stateKey].push({ path, frameUrl });

    if (mapping?.fps) {
      sequences[stateKey].fps = mapping.fps;
    }
  }

  Object.entries(byState).forEach(([stateKey, entries]) => {
    if (!entries.length) {
      return;
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    sequences[stateKey].frames = entries.map((entry) => entry.frameUrl);
  });

  return sequences;
}

export const DEFAULT_STATES = DEFAULT_STATE_META;
