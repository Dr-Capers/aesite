// Scrapper keeps the studio close, even when the wordmark takes a little break.
export function initBrand(character) {
  const brand = document.querySelector('.pg-brand');
  const mascot = brand?.querySelector('[data-character]');
  const logo = brand?.querySelector('.pg-wordmark');
  if (!character || !mascot || !logo) return;

  brand.insertAdjacentHTML('beforeend', `<svg class="pg-brand-filter" aria-hidden="true" width="0" height="0"><defs>
    <filter id="pg-liquid" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".035 .09" numOctaves="2" seed="8" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .333 .333 .333 0 0"/>
      <feComponentTransfer result="liquid"><feFuncA type="linear" slope="12" intercept="1" data-liquid-alpha/></feComponentTransfer>
      <feComposite in="SourceGraphic" in2="liquid" operator="in" result="masked"/>
      <feDisplacementMap in="masked" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" data-liquid-warp/>
    </filter>
  </defs></svg>`);
  const alpha = brand.querySelector('[data-liquid-alpha]');
  const warp = brand.querySelector('[data-liquid-warp]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let timer;
  let frame;
  let amount = 0;

  function animateTo(target) {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const from = amount;
    logo.classList.add('pg-wordmark--liquid');
    const tick = (now) => {
      const progress = reduced.matches ? 1 : Math.min((now - start) / 1100, 1);
      const eased = progress * progress * (3 - 2 * progress);
      amount = from + (target - from) * eased;
      alpha.setAttribute('intercept', String(1 - 12 * amount));
      warp.setAttribute('scale', String(Math.sin(amount * Math.PI) * 7));
      logo.style.opacity = String(1 - amount);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        logo.classList.remove('pg-wordmark--liquid');
        if (target === 1) {
          logo.inert = true;
          logo.setAttribute('aria-hidden', 'true');
        }
      }
    };
    frame = requestAnimationFrame(tick);
  }
  function scheduleFade() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!logo.contains(document.activeElement)) animateTo(1);
    }, 5000);
  }
  function reveal() {
    logo.inert = false;
    logo.removeAttribute('aria-hidden');
    animateTo(0);
    scheduleFade();
  }
  function sneeze() {
    character.clearTransientTimeouts();
    character.pendingState = null;
    character.playLoopingState('sneeze', { loops: 1, fallback: 'idle', forceRestart: true, force: true });
    reveal();
  }
  mascot.addEventListener('click', sneeze);
  mascot.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      sneeze();
    }
  });
  // The existing hover interaction can also make Scrapper sneeze.
  new MutationObserver(() => {
    if (mascot.dataset.characterState === 'sneeze') reveal();
  }).observe(mascot, { attributes: true, attributeFilter: ['data-character-state'] });
  logo.addEventListener('focus', () => { clearTimeout(timer); animateTo(0); });
  logo.addEventListener('blur', scheduleFade);
  scheduleFade();
}
