(function () {
  let uid = 0;

  function nextId(prefix) {
    uid += 1;
    return `${prefix}-${uid}`;
  }

  function fanSVG(variant) {
    const id = nextId('lg');
    const originX = variant === 'wide' ? 600 : 600;
    const originY = variant === 'wide' ? 420 : 380;

    return `
      <svg viewBox="0 0 1200 ${variant === 'wide' ? 500 : 420}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="${id}-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="${id}-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#39FF14" stop-opacity="0"/>
            <stop offset="45%" stop-color="#39FF14" stop-opacity="1"/>
            <stop offset="100%" stop-color="#39FF14" stop-opacity="0.2"/>
          </linearGradient>
          <linearGradient id="${id}-c" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00E8FF" stop-opacity="0"/>
            <stop offset="50%" stop-color="#00E8FF" stop-opacity="1"/>
            <stop offset="100%" stop-color="#00E8FF" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="${id}-p" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#B026FF" stop-opacity="0"/>
            <stop offset="50%" stop-color="#B026FF" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#B026FF" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="${id}-haze" cx="50%" cy="90%" r="60%">
            <stop offset="0%" stop-color="#39FF14" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#39FF14" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse class="laser-haze" cx="${originX}" cy="${originY - 40}" rx="320" ry="120" fill="url(#${id}-haze)"/>
        <g filter="url(#${id}-glow)">
          <line class="laser-beam laser-beam--slow" x1="${originX}" y1="${originY}" x2="80" y2="30" stroke="url(#${id}-g)" stroke-width="3"/>
          <line class="laser-beam" x1="${originX}" y1="${originY}" x2="280" y2="20" stroke="url(#${id}-g)" stroke-width="2.5"/>
          <line class="laser-beam laser-beam--alt" x1="${originX}" y1="${originY}" x2="520" y2="10" stroke="url(#${id}-c)" stroke-width="2"/>
          <line class="laser-beam laser-beam--fast" x1="${originX}" y1="${originY}" x2="760" y2="25" stroke="url(#${id}-c)" stroke-width="2.5"/>
          <line class="laser-beam laser-beam--slow" x1="${originX}" y1="${originY}" x2="980" y2="50" stroke="url(#${id}-p)" stroke-width="3"/>
          <line class="laser-beam laser-beam--alt" x1="${originX}" y1="${originY}" x2="1120" y2="90" stroke="url(#${id}-p)" stroke-width="2"/>
          <line class="laser-beam laser-beam--fast" x1="${originX}" y1="${originY}" x2="1120" y2="200" stroke="url(#${id}-g)" stroke-width="1.5" opacity="0.6"/>
          <line class="laser-beam" x1="${originX}" y1="${originY}" x2="60" y2="180" stroke="url(#${id}-p)" stroke-width="1.5" opacity="0.6"/>
        </g>
        <circle class="laser-origin" cx="${originX}" cy="${originY}" r="5" fill="#39FF14"/>
        <circle cx="${originX}" cy="${originY}" r="12" fill="none" stroke="#39FF14" stroke-width="1" opacity="0.4"/>
      </svg>`;
  }

  function dividerSVG() {
    const id = nextId('div');
    return `
      <svg viewBox="0 0 1200 72" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="${id}-glow" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#${id}-glow)">
          <line class="laser-beam" x1="0" y1="60" x2="1200" y2="12" stroke="#39FF14" stroke-width="2" opacity="0.7"/>
          <line class="laser-beam" x1="0" y1="12" x2="1200" y2="58" stroke="#00E8FF" stroke-width="1.5" opacity="0.55"/>
          <line class="laser-beam" x1="200" y1="36" x2="1000" y2="36" stroke="#B026FF" stroke-width="1.5" opacity="0.45"/>
        </g>
      </svg>`;
  }

  function mountScene(el, variant) {
    if (!el || el.querySelector('.laser-scene')) return;
    const scene = document.createElement('div');
    scene.className = 'laser-scene';
    scene.innerHTML = fanSVG(variant);
    el.prepend(scene);
  }

  function mountDivider(el) {
    if (!el) return;
    el.classList.add('laser-divider');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = dividerSVG();
  }

  function initPageHeroLasers() {
    document.querySelectorAll('.page-hero').forEach((hero) => {
      mountScene(hero, hero.classList.contains('page-hero--about') ? 'wide' : 'default');
    });
  }

  function initDividers() {
    document.querySelectorAll('[data-laser-divider]').forEach(mountDivider);
  }

  function initLaserCorners() {
    document.querySelectorAll('.laser-corners').forEach((section) => {
      if (!section.querySelector('.laser-scan')) {
        const scan = document.createElement('div');
        scan.className = 'laser-scan';
        section.prepend(scan);
      }
    });
  }

  function initHomeHero() {
    const hero = document.querySelector('.hero-beams');
    if (!hero) return;
    hero.innerHTML = fanSVG('wide');
    hero.classList.add('laser-scene');
  }

  function initHeroScan() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.laser-scan')) return;
    const scan = document.createElement('div');
    scan.className = 'laser-scan';
    const beams = hero.querySelector('.hero-beams');
    if (beams) beams.after(scan);
    else hero.prepend(scan);
  }

  function init() {
    initHomeHero();
    initHeroScan();
    initPageHeroLasers();
    initDividers();
    initLaserCorners();
  }

  window.LaserGatorFX = { init };
})();
