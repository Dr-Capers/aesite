const DISCORD_URL = 'https://discord.gg/vhmaXxQQ3b';
const INSTAGRAM_URL = 'https://www.instagram.com/planetarygames_/';
const APP_STORE_URL = 'https://apps.apple.com/us/app/thumb-war/id6476893306';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ArcadeEarthLLC.ThumbWar&hl=en_US';
const LIBRARY_SESSION_KEY = 'arcadeEarthLibrarySession';

const PRODUCTS = [
  {
    sku: 'comic-digital',
    name: 'Digital Edition',
    title: 'Digital Edition',
    price: '$9.99',
    description: 'Read Arcade Earth: Rise of Vector as a PDF across your devices, with secure Library access whenever you need it.',
    cta: 'Buy Digital Comic',
    checkoutNote: 'Opens secure Stripe Checkout. Library access is sent after payment.',
    image: '/assets/comic%20page/digital%20edition.png',
  },
  {
    sku: 'comic-motion',
    name: 'Motion Video Comic',
    title: 'Video Edition',
    price: '$14.99',
    description: 'A fully voice-acted video version of the story, built for fans who want to watch the comic come alive.',
    cta: 'Coming Soon',
    checkoutNote: 'Video Edition purchases are temporarily on hold while we finish launch access.',
    hold: true,
    image: '/assets/comic%20page/motion%20video%20comic.png',
  },
  {
    sku: 'comic-physical',
    name: 'Physical Edition',
    title: 'Physical Edition',
    price: '$29.99',
    description: 'The printed edition of Rise of Vector for collectors who want Arcade Earth on the shelf and in their hands.',
    cta: 'Coming Soon',
    checkoutNote: 'Physical Edition purchases are temporarily on hold while we finalize shipping.',
    hold: true,
    image: '/assets/comic%20page/physical%20edition.png',
  },
  {
    sku: 'comic-ultimate-bundle',
    name: 'Ultimate Bundle',
    title: 'Ultimate Bundle',
    price: '$44.99',
    description: 'The complete launch bundle: printed comic, digital PDF, motion comic, and bonus Library access in one order.',
    cta: 'Coming Soon',
    checkoutNote: 'Ultimate Bundle purchases are temporarily on hold while we finalize all included formats.',
    hold: true,
    featured: true,
    image: '/assets/comic%20page/ultimate%20bundle.png',
  },
];

const ROUTES = [
  { label: 'Home', href: '/' },
  { label: 'Comic', href: '/comic' },
  { label: 'Games', href: '/games' },
  { label: 'Library', href: '/library' },
  { label: 'Community', href: DISCORD_URL, external: true },
];

const DOWNLOAD_MEDIA = {
  game: [
    { type: 'image', src: '/assets/style-lab/thumb-war-logo-cropped.png', alt: 'Thumb War logo', fit: 'logo' },
    { type: 'image', src: '/assets/REAL%20SUBWAY%20SCENE.png', alt: 'Thumb War subway scene', fit: 'cover' },
  ],
  comic: [
    { type: 'image', src: '/assets/style-lab/arcade-earth-rise-of-vector-logo.png', alt: 'Arcade Earth: Rise of Vector logo', fit: 'logo' },
    { type: 'image', src: '/assets/comic%20page/downloadpageimage.png', alt: 'Arcade Earth: Rise of Vector comic art', fit: 'cover' },
  ],
};

const routeMeta = {
  '/': ['Arcade Earth | Planetary Games', 'Explore Arcade Earth comics, real-world games, community, and your Library.'],
  '/download': ['Arcade Earth Download Hub', 'Play Thumb War or read more about Arcade Earth: Rise of Vector.'],
  '/comic': ['Arcade Earth: Rise of Vector | Comic', 'Buy Arcade Earth: Rise of Vector digital, motion, physical, and bundle editions.'],
  '/games': ['Arcade Earth Games', 'Download Thumb War and explore future Arcade Earth games.'],
  '/comic/success': ['Arcade Earth Checkout', 'Confirm your Arcade Earth purchase and open your Library.'],
  '/library': ['Arcade Earth Library', 'Access purchased Arcade Earth comics and motion video comics.'],
  '/library/access': ['Arcade Earth Library Access', 'Request a secure magic link for your Arcade Earth Library.'],
  '/library/session': ['Opening Arcade Earth Library', 'Verify a secure Arcade Earth Library link.'],
  '/read': ['Read Arcade Earth | Library', 'Read purchased Arcade Earth comics through your secure Library session.'],
  '/watch': ['Watch Arcade Earth | Library', 'Watch purchased Arcade Earth motion comics through your secure Library session.'],
};

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/thumb-war') {
    return '/games';
  }
  return path;
}

function setMeta(path) {
  const key = path.startsWith('/read/') ? '/read' : path.startsWith('/watch/') ? '/watch' : path;
  const [title, description] = routeMeta[key] || ['Arcade Earth', 'Explore Arcade Earth from Planetary Games.'];
  document.title = title;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  }
}

function navLink(route, currentPath) {
  const libraryPath = currentPath.startsWith('/read/') || currentPath.startsWith('/watch/') || currentPath.startsWith('/library');
  const active = !route.external && (
    currentPath === route.href ||
    (route.href !== '/' && currentPath.startsWith(route.href)) ||
    (route.href === '/library' && libraryPath)
  );
  return `<a href="${route.href}" ${route.external ? 'target="_blank" rel="noreferrer"' : ''} ${active ? 'aria-current="page"' : ''}>${route.label}</a>`;
}

function shell(content, currentPath) {
  const deferBackdrop = currentPath === '/comic';
  return `
    <div class="ae-backdrop" aria-hidden="true">
      <video
        class="ae-backdrop__video"
        ${deferBackdrop ? 'data-src="/assets/style-lab/planetary-games-logo-video.mp4" preload="none"' : 'src="/assets/style-lab/planetary-games-logo-video.mp4"'}
        autoplay
        muted
        loop
        playsinline
        data-backdrop-video
      ></video>
    </div>
    <header class="ae-nav">
      <a class="ae-mark" href="/" aria-label="Arcade Earth">
        <img src="/assets/AELogo.png" alt="">
      </a>
      <button class="ae-nav__toggle" type="button" aria-expanded="false" aria-controls="site-links" data-nav-toggle>Menu</button>
      <nav class="ae-nav__links" id="site-links" aria-label="Primary navigation" data-nav-links>
        ${ROUTES.map((route) => navLink(route, currentPath)).join('')}
      </nav>
    </header>
    <main class="ae-page" id="main-content">${content}</main>
    <footer class="ae-footer">
      <div>
        <strong>Planetary Games</strong>
        <span>Turning screentime into face time :)</span>
      </div>
      <nav aria-label="Footer links">
        <a href="${INSTAGRAM_URL}" target="_blank" rel="noreferrer">Instagram</a>
        <a href="${DISCORD_URL}" target="_blank" rel="noreferrer">Discord</a>
        <a href="mailto:hello@arcade.earth">Support</a>
        <a href="/legal/terms.html">Terms</a>
        <a href="/legal/privacy.html">Privacy</a>
      </nav>
    </footer>
  `;
}

function characterMarkup() {
  return `
    <div class="character-display ae-character" data-character role="img" aria-label="Arcade Earth mascot animation" tabindex="0">
      <div class="character-fallback" data-character-fallback role="status" aria-live="polite" hidden>
        <div class="character-fallback__glyph" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="sr-only">Loading mascot animation</span>
      </div>
    </div>
  `;
}

function downloadCarousel(kind, label) {
  const slides = DOWNLOAD_MEDIA[kind] || [];
  return `
    <div class="ae-download-card__media ae-download-carousel ae-download-carousel--${kind}" data-download-carousel>
      <div class="ae-download-carousel__track" data-carousel-track aria-label="${label}">
        ${slides.map((slide, index) => {
          if (slide.type === 'image') {
            return `
              <figure class="ae-download-slide ae-download-slide--image ae-download-slide--${slide.fit || 'logo'}" aria-label="${slide.alt}">
                <img src="${slide.src}" alt="${slide.alt}">
              </figure>
            `;
          }
          return `
            <figure class="ae-download-slide ae-download-slide--placeholder ae-download-slide--${kind}" aria-label="${slide.title}">
              <span>${slide.eyebrow}</span>
              <strong>${slide.title}</strong>
            </figure>
          `;
        }).join('')}
      </div>
      <div class="ae-download-carousel__controls">
        <button type="button" aria-label="Previous ${label}" data-carousel-prev>&lt;</button>
        <div class="ae-download-carousel__dots" aria-hidden="true">
          ${slides.map((_, index) => `<span ${index === 0 ? 'aria-current="true"' : ''}></span>`).join('')}
        </div>
        <button type="button" aria-label="Next ${label}" data-carousel-next>&gt;</button>
      </div>
    </div>
  `;
}

function homePage() {
  return `
    <section class="ae-hero ae-hero--home">
      <div class="ae-hero__copy">
        <p class="ae-eyebrow">Planetary Games presents</p>
        <h1><span>Arcade</span><span>Earth</span></h1>
        <p>A connected universe of comics and real-world games, built to bring people together beyond the screen.</p>
        <div class="ae-actions">
          <a class="ae-button ae-button--primary" href="/comic">Explore the Comic</a>
          <a class="ae-button" href="/games#thumb-war">Download Thumb War</a>
        </div>
      </div>
      <div class="ae-hero__visual">${characterMarkup()}</div>
    </section>
    <section class="ae-band" aria-label="Explore Arcade Earth">
      ${[
        ['Comic', 'Start with RISE OF VECTOR, the first Arcade Earth comic release.', '/comic'],
        ['Games', 'Play THUMB-WAR now and follow URBAN ARCADE in development.', '/games'],
        ['Library', 'Access the comics and media you own with a secure magic link.', '/library'],
        ['Community', 'Join Discord for drops, playtests, and behind-the-scenes updates.', DISCORD_URL],
      ].map(([title, copy, href]) => `
        <a class="ae-tile" href="${href}">
          <span>${title}</span>
          <p>${copy}</p>
        </a>
      `).join('')}
    </section>
    <section class="ae-signup-panel">
      <div>
        <p class="ae-eyebrow">Updates</p>
        <h2>Hear what's next.</h2>
      </div>
      <form class="ae-form" aria-label="Join the Arcade Earth list" data-signup-form>
        <label class="sr-only" for="launch-email">Email address</label>
        <input id="launch-email" type="email" name="email" placeholder="you@example.com" required data-signup-input>
        <button type="submit">Join list</button>
        <p class="signup-feedback ae-form__feedback" data-signup-feedback aria-live="polite" hidden></p>
      </form>
    </section>
  `;
}

function downloadPage() {
  return `
    <section class="ae-download-hero">
      <div>
        <h1>Let's Play.</h1>
      </div>
    </section>
    <section class="ae-download-options" aria-label="Arcade Earth destinations">
      <article class="ae-download-card ae-download-card--game">
        ${downloadCarousel('game', 'Thumb War media')}
        <p class="ae-eyebrow">Mobile game</p>
        <h2>Thumb War</h2>
        <p>A mobile battler built for real-world competition. Face off against friends on the same screen, where quick reflexes, clever tactics, and perfect timing decide the winner.</p>
        <div class="ae-actions">
          <a class="ae-button ae-button--primary" href="${APP_STORE_URL}" target="_blank" rel="noreferrer">App Store</a>
          <a class="ae-button" href="${PLAY_STORE_URL}" target="_blank" rel="noreferrer">Google Play</a>
        </div>
      </article>
      <article class="ae-download-card ae-download-card--comic">
        ${downloadCarousel('comic', 'Rise of Vector media')}
        <p class="ae-eyebrow">Comic</p>
        <h2>Rise of Vector</h2>
        <p>Dr. Capers is a game-obsessed inventor. P1 is a digital hero from a ruined future. Together, they have to turn Earth into a planet-sized video game before Vector eats every timeline left.</p>
        <a class="ae-button" href="/comic">Read More</a>
      </article>
    </section>
  `;
}

function productCards() {
  return PRODUCTS.map((product) => `
    <article class="ae-product-card${product.featured ? ' ae-product-card--featured' : ''}${product.hold ? ' ae-product-card--held' : ''}" data-product-sku="${product.sku}">
      <header class="ae-product-card__head">
        <h3>${product.title}</h3>
        <p class="ae-product-card__price">${product.price}</p>
        ${product.hold ? '<p class="ae-product-card__badge">Coming soon</p>' : ''}
      </header>
      <figure class="ae-product-card__media" aria-label="${product.name} artwork">
        <img src="${product.image}" alt="${product.name}">
      </figure>
      <div class="ae-product-card__info">
        <p class="ae-product-card__description">${product.description}</p>
      </div>
      <div class="ae-checkout-control">
        ${product.hold
          ? `<button class="ae-button ae-button--held" type="button" disabled aria-disabled="true">${product.cta}</button>`
          : `<button class="ae-button ${product.featured ? 'ae-button--primary' : ''}" type="button" data-checkout-sku="${product.sku}">${product.cta}</button>`}
        <p>${product.checkoutNote}</p>
        <p class="ae-checkout-status" role="status" aria-live="polite" data-checkout-status hidden></p>
      </div>
    </article>
  `).join('');
}

function comicPage() {
  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get('checkout') === 'cancelled';
  return `
    <section class="ae-hero ae-hero--comic">
      <div class="ae-comic-cover" aria-label="Arcade Earth: Rise of Vector cover art">
        <img
          src="/assets/comic%20page/herooption2.png"
          alt="Arcade Earth: Rise of Vector comic cover"
          width="900"
          height="600"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          data-critical-image
        >
      </div>
      <div class="ae-hero__copy">
        <p class="ae-eyebrow">Arcade Earth comic</p>
        <h1>Rise of Vector</h1>
        <p>Dr. Capers is a game-obsessed inventor. P1 is a digital hero from a ruined future. Together, they have to turn Earth into a planet-sized video game before Vector eats every timeline left.</p>
        <div class="ae-actions">
          <a class="ae-button ae-button--primary" href="#editions" data-smooth-scroll>Pick an Edition</a>
          <a class="ae-button" href="/library">Open Library</a>
        </div>
      </div>
    </section>
    <section class="ae-section" id="editions">
      <div class="ae-section__head">
        <p class="ae-eyebrow">Launch editions</p>
        <h2>Choose your format.</h2>
        ${cancelled ? `
          <div class="ae-checkout-alert" role="status">
            <strong>Checkout was cancelled.</strong>
            <span>No charge was made. You can pick an edition again whenever you are ready.</span>
          </div>
        ` : ''}
      </div>
      <div class="ae-checkout-guide" aria-label="Checkout steps">
        <span><strong>1</strong> Pick an edition</span>
        <span><strong>2</strong> Pay securely on Stripe</span>
        <span><strong>3</strong> Open your Library email</span>
      </div>
      <div class="ae-products">${productCards()}</div>
      <div class="ae-note-strip">
        <p>Physical Edition and Ultimate Bundle shipping is available to United States addresses only.</p>
        <p>Standard Shipping is $6.99 and usually arrives in 5-10 business days after fulfillment.</p>
        <p>For access problems, damaged shipments, or fulfillment mistakes, contact hello@arcade.earth.</p>
      </div>
    </section>
    <section class="ae-section ae-faq">
      <h2>Frequently asked questions.</h2>
      <details open><summary>How do I access my digital comic later?</summary><p>Use the Arcade Earth Library link from your email, or request a new magic link from the Library access page.</p></details>
      <details><summary>Are downloads limited?</summary><p>Signed download links are short-lived, but normal customer redownloads are supported.</p></details>
      <details><summary>How does the digital edition work on mobile?</summary><p>For the best reading experience, we recommend using a computer. Mobile browsers handle PDFs differently. If the in-page reader feels cramped, tap Download PDF from your Library. On some phones this opens the comic in the browser or system PDF viewer instead of saving a file, which usually gives a better mobile reading experience. You can request a fresh Library link later if the signed link expires.</p></details>
      <details><summary>Is the physical comic digital too?</summary><p>The standalone Physical Edition is print-only. Choose the Ultimate Bundle if you want physical, digital, and motion access together.</p></details>
      <details><summary>Where do you ship?</summary><p>Physical Edition and Ultimate Bundle shipping is available to United States addresses only for this launch.</p></details>
      <details><summary>How much is shipping?</summary><p>Standard shipping is a flat $6.99 USD and usually arrives in 5-10 business days after fulfillment.</p></details>
      <details><summary>Is there a Book Two?</summary><p>Book Two is coming. Follow Planetary Games on Instagram or join the email list to get updates.</p></details>
    </section>
  `;
}

function gamesPage() {
  return `
    <section class="ae-games-page">
      <header class="ae-games-hero">
        <div>
          <h1>Games for the real world.</h1>
        </div>
      </header>

      <div class="ae-games-list">
        <article class="ae-games-feature ae-games-feature--thumb" id="thumb-war">
          <figure class="ae-games-art" aria-label="Thumb War subway scene art">
            <img src="/assets/REAL%20SUBWAY%20SCENE.png" alt="Thumb War subway scene">
          </figure>
          <div class="ae-games-project ae-games-project--thumb">
            <img class="ae-games-project__logo" src="/assets/style-lab/thumb-war-logo-cropped.png" alt="Thumb War">
            <p>A mobile battler built for real-world competition.</p>
            <p>Face off against friends on the same screen, where quick reflexes, clever tactics, and perfect timing decide the winner.</p>
            <p>The world's first sport that fits in your pocket.</p>
            <div class="ae-actions">
              <a class="ae-button ae-button--primary" href="${APP_STORE_URL}" target="_blank" rel="noreferrer">App Store</a>
              <a class="ae-button" href="${PLAY_STORE_URL}" target="_blank" rel="noreferrer">Google Play</a>
            </div>
          </div>
        </article>

        <article class="ae-games-feature ae-games-feature--urban">
          <figure class="ae-games-art" aria-label="Urban Arcade park scene art">
            <img src="/assets/PARK%20SCENE.png" alt="Urban Arcade park scene">
          </figure>
          <div class="ae-games-project ae-games-project--urban ae-games-project--development">
            <p class="ae-pill">In development</p>
            <img class="ae-games-project__logo ae-games-project__logo--urban" src="/assets/URBAN%20ARCADE%20LOGO.png" alt="Urban Arcade">
            <p>Team up with your Arcadian partner and see the world through new eyes.</p>
            <p>Turn your city into a playground of hidden discoveries, local rivalries, and epic adventures.</p>
            <p>Fight to reclaim your neighborhood!</p>
          </div>
        </article>
      </div>

      <section class="ae-games-manifesto">
        <p>Turning screentime into face time.</p>
        <a class="ae-button ae-button--primary" href="/download">Download Thumb War</a>
      </section>
    </section>
  `;
}

function successPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const cancelled = params.get('checkout') === 'cancelled';
  const title = cancelled ? 'Checkout cancelled.' : sessionId ? 'Payment received.' : 'Order confirmation pending.';
  const message = cancelled
    ? 'No payment was completed and no charge was made. Return to the comic page to pick an edition.'
    : sessionId
      ? 'Stripe sent you back after payment. We are creating your order and Library access now; your Library email should arrive shortly.'
      : 'If you completed checkout, your Library email should arrive shortly. You can also request a fresh Library link using the checkout email.';
  return `
    <section class="ae-state" data-success-state="${cancelled ? 'cancelled' : sessionId ? 'verifying' : 'pending'}">
      <p class="ae-eyebrow">Checkout</p>
      <h1>${title}</h1>
      <p data-success-message>${message}</p>
      ${sessionId && !cancelled ? '<p class="ae-muted">Keep this page handy until your email arrives. If it does not show up after a few minutes, request a Library link below using the same email you used at checkout.</p>' : ''}
      <div class="ae-actions">
        <a class="ae-button ae-button--primary" href="/library">Open Library</a>
        <a class="ae-button" href="/library/access">Send Library Email</a>
        <a class="ae-button" href="/comic">Back to Comic</a>
      </div>
    </section>
  `;
}

function libraryAccessPage() {
  return `
    <section class="ae-state">
      <h1>Request Library access.</h1>
      <p>Enter the email used at checkout. If purchases exist for that email, we will send Library access.</p>
      <form class="ae-form ae-form--stack" data-library-access-form>
        <label for="library-email">Email address</label>
        <input id="library-email" type="email" name="email" autocomplete="email" required>
        <button class="ae-button ae-button--primary" type="submit">Send Magic Link</button>
        <p class="ae-form__feedback" role="status" data-library-access-feedback></p>
      </form>
      <a class="ae-link" href="/comic">Back to comic</a>
    </section>
  `;
}

function libraryPage() {
  const session = readLibrarySession();
  if (!session?.token) {
    return `
      <section class="ae-state">
        <h1>Your Library lives here.</h1>
        <p>Use a secure email magic link to view purchased comics, motion video comics, and downloads.</p>
        <div class="ae-actions">
          <a class="ae-button ae-button--primary" href="/library/access">Get Library Access</a>
          <a class="ae-button" href="/comic">Explore the Comic</a>
        </div>
      </section>
    `;
  }

  return `
    <section class="ae-section" data-library-shell>
      <div class="ae-section__head">
        <h1>Purchased</h1>
        <p data-library-email>Signed in by secure Library link.</p>
      </div>
      <div class="ae-library-list" data-library-list>
        <article class="ae-library-item ae-library-item--loading">Loading your Library...</article>
      </div>
    </section>
  `;
}

function sessionPage() {
  return `
    <section class="ae-state" data-session-verifier>
      <h1>Opening your Library.</h1>
      <p data-session-message>Verifying your secure link...</p>
      <div class="ae-actions">
        <a class="ae-button" href="/library/access">Request a new link</a>
      </div>
    </section>
  `;
}

function mediaPage(kind, slug) {
  const isWatch = kind === 'watch';
  return `
    <section class="ae-media" data-media-page data-media-kind="${kind}" data-product-slug="${slug}">
      <div class="ae-media__head">
        <a class="ae-link" href="/library">Back to Library</a>
        <h1>${isWatch ? 'Watch Motion Comic' : 'Read Online'}</h1>
      </div>
      <div class="ae-media__frame" data-media-frame>
        ${isWatch ? '<video controls playsinline data-media-video></video>' : '<iframe title="Arcade Earth comic reader" data-media-reader></iframe>'}
        <p data-media-message>Loading secure access...</p>
      </div>
      <div class="ae-media__actions">
        <button class="ae-button" type="button" data-media-download>${isWatch ? 'Download for Offline Viewing' : 'Download PDF'}</button>
        <a class="ae-button" href="/library/access" data-media-access hidden>Request Access</a>
      </div>
    </section>
  `;
}

function notFoundPage() {
  return `
    <section class="ae-state">
      <p class="ae-eyebrow">Route unavailable</p>
      <h1>That page is not in the current build.</h1>
      <p>Explore the comic, games, or Library from the main navigation.</p>
      <a class="ae-button ae-button--primary" href="/">Go Home</a>
    </section>
  `;
}

function readLibrarySession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(LIBRARY_SESSION_KEY) || 'null');
    if (!session?.token) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      clearLibrarySession();
      return null;
    }
    return session;
  } catch (error) {
    return null;
  }
}

function writeLibrarySession(session) {
  window.localStorage.setItem(LIBRARY_SESSION_KEY, JSON.stringify(session));
}

function clearLibrarySession() {
  window.localStorage.removeItem(LIBRARY_SESSION_KEY);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('[data-nav-links]');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    links.toggleAttribute('data-open', !expanded);
  });
}

function initSmoothScrollLinks() {
  document.querySelectorAll('[data-smooth-scroll]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', href);
    });
  });
}

function initDownloadCarousels() {
  document.querySelectorAll('[data-download-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = Array.from(carousel.querySelectorAll('.ae-download-slide'));
    const dots = Array.from(carousel.querySelectorAll('.ae-download-carousel__dots span'));
    const previous = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    if (!track || !slides.length) return;

    const nearestIndex = () => {
      const slideWidth = slides[0].getBoundingClientRect().width || 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / slideWidth)));
    };

    const setActive = (index) => {
      dots.forEach((dot, dotIndex) => {
        if (dotIndex === index) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    };

    const goTo = (index) => {
      const nextIndex = (index + slides.length) % slides.length;
      track.scrollTo({ left: slides[nextIndex].offsetLeft, behavior: 'smooth' });
      setActive(nextIndex);
    };

    previous?.addEventListener('click', () => goTo(nearestIndex() - 1));
    next?.addEventListener('click', () => goTo(nearestIndex() + 1));

    track.addEventListener('scroll', () => {
      window.requestAnimationFrame(() => setActive(nearestIndex()));
    }, { passive: true });
  });
}

function initCheckout() {
  const checkoutButtons = Array.from(document.querySelectorAll('[data-checkout-sku]'));
  checkoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const sku = button.getAttribute('data-checkout-sku');
      const original = button.textContent;
      const card = button.closest('[data-product-sku]');
      const status = card?.querySelector('[data-checkout-status]');
      const setStatus = (message, state = 'pending') => {
        if (!status) return;
        status.hidden = false;
        status.dataset.state = state;
        status.textContent = message;
      };

      checkoutButtons.forEach((checkoutButton) => {
        checkoutButton.disabled = true;
        checkoutButton.setAttribute('aria-disabled', 'true');
      });
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Preparing Checkout...';
      setStatus('Preparing secure Stripe Checkout. Keep this tab open; you will be redirected in a moment.');

      try {
        const { url } = await postJson('/api/createComicCheckoutSession', {
          sku,
          quantity: 1,
          siteBase: window.location.origin,
        });
        if (!url) {
          throw new Error('Checkout did not return a Stripe link.');
        }
        setStatus('Redirecting to Stripe Checkout. Complete payment there, then return here for Library access.', 'success');
        button.textContent = 'Redirecting...';
        window.location.assign(url);
      } catch (error) {
        button.removeAttribute('aria-busy');
        button.textContent = 'Try Again';
        setStatus(`${error.message || 'Checkout unavailable'} Please try again, or email hello@arcade.earth if this keeps happening.`, 'error');
        window.setTimeout(() => {
          button.textContent = original;
          checkoutButtons.forEach((checkoutButton) => {
            checkoutButton.disabled = false;
            checkoutButton.removeAttribute('aria-disabled');
          });
        }, 3200);
      }
    });
  });
}

function initLibraryAccess() {
  const form = document.querySelector('[data-library-access-form]');
  if (!form) return;
  const feedback = form.querySelector('[data-library-access-feedback]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = new FormData(form).get('email')?.toString().trim();
    const button = form.querySelector('button');
    button.disabled = true;
    feedback.textContent = 'Sending...';
    try {
      await postJson('/api/resendComicAccess', { email });
      feedback.textContent = 'If purchases exist for that email, we will send Library access.';
      form.reset();
    } catch (error) {
      feedback.textContent = error.message || 'We could not send access right now.';
    } finally {
      button.disabled = false;
    }
  });
}

async function initLibrarySession() {
  const verifier = document.querySelector('[data-session-verifier]');
  if (!verifier) return;
  const message = verifier.querySelector('[data-session-message]');
  const token = new URLSearchParams(window.location.search).get('t');
  if (!token) {
    clearLibrarySession();
    message.textContent = 'This Library link is missing a token.';
    return;
  }
  try {
    const session = await postJson('/api/verifyLibrarySession', { token });
    writeLibrarySession(session);
    window.history.replaceState({}, '', '/library/session');
    window.location.assign('/library');
  } catch (error) {
    clearLibrarySession();
    message.textContent = error.message || 'This Library link is invalid or expired.';
  }
}

function renderLibraryItems(items) {
  if (!items.length) {
    return `
      <article class="ae-library-item">
        <h2>No purchases visible yet.</h2>
        <p>If you just checked out, the access email may still be on its way.</p>
        <a class="ae-button ae-button--primary" href="/comic">Explore the Comic</a>
      </article>
    `;
  }
  return items.map((item) => `
    <article class="ae-library-item">
      <div>
        <p class="ae-eyebrow">${item.edition || 'Arcade Earth Vol. 1'}</p>
        <h2>Arcade Earth: Rise of Vector</h2>
        <p>Purchased ${item.purchaseDate || 'recently'}</p>
      </div>
      <div class="ae-library-item__actions">
        ${item.assetIds?.includes('comic-pdf-v1') ? '<a class="ae-button ae-button--primary" href="/read/rise-of-vector">Read Online</a><button class="ae-button" type="button" data-asset-action="download" data-asset-id="comic-pdf-v1">Download PDF</button>' : ''}
        ${item.assetIds?.includes('comic-motion-stream-v1') ? '<a class="ae-button ae-button--primary" href="/watch/rise-of-vector">Watch Motion Comic</a>' : ''}
        ${item.assetIds?.includes('comic-motion-download-v1') ? '<button class="ae-button" type="button" data-asset-action="download" data-asset-id="comic-motion-download-v1">Download Video</button>' : ''}
        ${item.fulfillmentType === 'physical' ? '<span class="ae-pill">Physical fulfillment processing</span>' : ''}
      </div>
    </article>
  `).join('');
}

async function initLibrary() {
  const list = document.querySelector('[data-library-list]');
  if (!list) return;
  const session = readLibrarySession();
  if (!session?.token) {
    list.innerHTML = '<article class="ae-library-item"><h2>Library session expired.</h2><p>Request a fresh secure link to continue.</p><a class="ae-button ae-button--primary" href="/library/access">Request Access</a></article>';
    return;
  }
  try {
    const data = await postJson('/api/getLibrary', { token: session.token });
    document.querySelector('[data-library-email]').textContent = `Signed in as ${data.email}`;
    list.innerHTML = renderLibraryItems(data.items || []);
    initAssetButtons();
  } catch (error) {
    clearLibrarySession();
    list.innerHTML = `<article class="ae-library-item"><h2>Library session expired.</h2><p>${error.message || 'Request a new Library link to continue.'}</p><a class="ae-button ae-button--primary" href="/library/access">Request Access</a></article>`;
  }
}

function initAssetButtons() {
  document.querySelectorAll('[data-asset-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const session = readLibrarySession();
      button.disabled = true;
      const original = button.textContent;
      if (!session?.token) {
        button.textContent = 'Request Library access';
        window.setTimeout(() => {
          window.location.assign('/library/access');
        }, 900);
        return;
      }
      button.textContent = 'Preparing...';
      try {
        const data = await postJson('/api/createAssetAccess', {
          token: session?.token,
          action: button.getAttribute('data-asset-action'),
          assetId: button.getAttribute('data-asset-id'),
        });
        window.open(data.url, '_blank', 'noopener');
      } catch (error) {
        button.textContent = error.message || 'Access unavailable';
        window.setTimeout(() => {
          button.textContent = original;
          button.disabled = false;
        }, 2400);
      }
    });
  });
}

async function initMediaPage() {
  const page = document.querySelector('[data-media-page]');
  if (!page) return;
  const session = readLibrarySession();
  const kind = page.getAttribute('data-media-kind');
  const isWatch = kind === 'watch';
  const assetId = isWatch ? 'comic-motion-stream-v1' : 'comic-pdf-v1';
  const message = page.querySelector('[data-media-message]');
  const downloadButton = page.querySelector('[data-media-download]');
  const accessLink = page.querySelector('[data-media-access]');
  if (!session?.token) {
    message.textContent = 'Your Library session has expired. Request a fresh secure link to continue.';
    downloadButton.disabled = true;
    accessLink.hidden = false;
    return;
  }
  try {
    const data = await postJson('/api/createAssetAccess', {
      token: session?.token,
      action: isWatch ? 'stream' : 'read',
      assetId,
    });
    if (isWatch) {
      page.querySelector('[data-media-video]').src = data.url;
    } else {
      page.querySelector('[data-media-reader]').src = data.url;
    }
    message.hidden = true;
  } catch (error) {
    message.textContent = error.message || 'Secure access unavailable.';
    if (/session|link|expired|required/i.test(message.textContent)) {
      clearLibrarySession();
      accessLink.hidden = false;
    }
  }
  downloadButton?.addEventListener('click', async () => {
    const button = downloadButton;
    const original = button.textContent;
    const activeSession = readLibrarySession();
    if (!activeSession?.token) {
      button.disabled = true;
      button.textContent = 'Request Library access';
      accessLink.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = 'Preparing...';
    try {
      const data = await postJson('/api/createAssetAccess', {
        token: activeSession.token,
        action: 'download',
        assetId: isWatch ? 'comic-motion-download-v1' : 'comic-pdf-v1',
      });
      window.open(data.url, '_blank', 'noopener');
      button.textContent = original;
      button.disabled = false;
    } catch (error) {
      button.textContent = error.message || 'Download unavailable';
      if (/session|link|expired|required/i.test(button.textContent)) {
        clearLibrarySession();
        accessLink.hidden = false;
      }
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 2400);
    }
  });
}

function initBackdropVideo() {
  const video = document.querySelector('[data-backdrop-video]');
  const deferredSrc = video?.dataset?.src;
  if (!video || !deferredSrc) {
    return;
  }

  let started = false;
  let fallbackTimer = null;
  const startVideo = () => {
    if (started) {
      return;
    }
    started = true;
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
    }
    video.src = deferredSrc;
    video.load();
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  };

  const startAfterPaint = async () => {
    const criticalImage = document.querySelector('[data-critical-image]');
    if (criticalImage && typeof criticalImage.decode === 'function') {
      try {
        await criticalImage.decode();
      } catch (error) {
        // A completed image can still reject decode; it is safe to continue.
      }
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(startVideo));
  };

  const criticalImage = document.querySelector('[data-critical-image]');
  if (!criticalImage) {
    startVideo();
    return;
  }

  if (criticalImage.complete && criticalImage.naturalWidth > 0) {
    startAfterPaint();
  } else {
    criticalImage.addEventListener('load', startAfterPaint, { once: true });
    criticalImage.addEventListener('error', startVideo, { once: true });
    fallbackTimer = window.setTimeout(startVideo, 3000);
  }
}

export function renderSite() {
  const app = document.querySelector('#app');
  const path = normalizePath(window.location.pathname);
  setMeta(path);

  let content;
  if (path === '/') content = homePage();
  else if (path === '/download') content = downloadPage();
  else if (path === '/comic') content = comicPage();
  else if (path === '/games') content = gamesPage();
  else if (path === '/comic/success') content = successPage();
  else if (path === '/library') content = libraryPage();
  else if (path === '/library/access') content = libraryAccessPage();
  else if (path === '/library/session') content = sessionPage();
  else if (path.startsWith('/read/')) content = mediaPage('read', path.split('/').pop());
  else if (path.startsWith('/watch/')) content = mediaPage('watch', path.split('/').pop());
  else content = notFoundPage();

  app.innerHTML = shell(content, path);
  initBackdropVideo();
  initNav();
  initSmoothScrollLinks();
  initDownloadCarousels();
  initCheckout();
  initLibraryAccess();
  initLibrarySession();
  initLibrary();
  initAssetButtons();
  initMediaPage();
}
