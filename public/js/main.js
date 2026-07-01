(function () {
  const LOGO = { src: '/assets/logo-icon.png', alt: 'LaserGator' };

  function renderLogoMark(footer = false) {
    const imgClass = footer ? 'logo-mark logo-mark--footer' : 'logo-mark';
    return `<img src="${LOGO.src}" alt="" class="${imgClass}">`;
  }

  const NAV_ITEMS = [
    { href: '/index.html', label: 'Home', page: 'home' },
    { href: '/services.html', label: 'Services', page: 'services' },
    { href: '/gallery.html', label: 'Gallery', page: 'gallery' },
    { href: '/about.html', label: 'About', page: 'about' },
    { href: '/events.html', label: 'Events', page: 'events' },
    { href: '/contact.html', label: 'Contact', page: 'contact' },
  ];

  const currentPage = document.body.dataset.page || '';

  function renderNav() {
    const el = document.getElementById('site-nav');
    if (!el) return;

    const links = NAV_ITEMS.map((item) => {
      const active = item.page === currentPage ? ' active' : '';
      return `<li><a href="${item.href}" class="${active.trim()}">${item.label}</a></li>`;
    }).join('');

    el.innerHTML = `
      <header class="site-header">
        <div class="container nav-inner">
          <a href="/index.html" class="logo-link" aria-label="${LOGO.alt} home">
            ${renderLogoMark()}
            <span class="logo-text">LASERGATOR</span>
          </a>
          <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
          <ul class="nav-links">${links}
            <li class="nav-cta"><a href="/contact.html#book" class="btn btn-primary">Book Now</a></li>
          </ul>
        </div>
      </header>`;

    const toggle = el.querySelector('.nav-toggle');
    const menu = el.querySelector('.nav-links');
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => menu.classList.remove('open'));
    });
  }

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;

    el.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-brand">
            <a href="/index.html" class="logo-link" aria-label="${LOGO.alt} home">
              ${renderLogoMark(true)}
              <span class="logo-text">LASERGATOR</span>
            </a>
            <p>Professional laser shows for live events, festivals, and corporate productions across the Pacific Northwest and beyond.</p>
          </div>
          <div class="footer-links">
            <h4>Explore</h4>
            <ul>
              <li><a href="/services.html">Services</a></li>
              <li><a href="/gallery.html">Gallery</a></li>
              <li><a href="/about.html">About</a></li>
              <li><a href="/about.html#compliance">Safety &amp; Compliance</a></li>
              <li><a href="/events.html">Events</a></li>
              <li><a href="/contact.html">Contact</a></li>
            </ul>
          </div>
          <div class="footer-contact">
            <h4>Contact</h4>
            <p><a href="tel:9073439163">Milo: 907-343-9163</a></p>
            <p><a href="tel:3607894424">Paul: 360-789-4424</a></p>
            <p><a href="mailto:paul@laser-gator.com">paul@laser-gator.com</a></p>
            <p><a href="mailto:milo@laser-gator.com">milo@laser-gator.com</a></p>
          </div>
        </div>
        <div class="container footer-bottom">
          <p>&copy; ${new Date().getFullYear()} LaserGator. All rights reserved.</p>
        </div>
      </footer>`;
  }

  let fadeInObserver;

  function getFadeInObserver() {
    if (fadeInObserver) return fadeInObserver;

    fadeInObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeInObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    return fadeInObserver;
  }

  function revealFadeIns(root) {
    const scope = root || document;
    const els = scope.querySelectorAll('.fade-in:not(.visible)');
    if (!els.length) return;

    const observer = getFadeInObserver();
    els.forEach((el) => observer.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    renderFooter();
    revealFadeIns();
    window.LaserGatorFX?.init();
  });

  window.LaserGator = { revealFadeIns };
})();
