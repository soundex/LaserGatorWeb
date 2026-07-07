(function () {
  const ROTATE_MS = 9000;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatAttribution(item) {
    if (item.role) return `${item.author}, ${item.role}`;
    return item.author;
  }

  function renderSlide(item, index, total) {
    return `
      <blockquote class="testimonial-slide${index === 0 ? ' is-active' : ''}" data-index="${index}" ${index === 0 ? '' : 'hidden'}>
        <p class="testimonial-quote">${escapeHtml(item.quote)}</p>
        <footer class="testimonial-author">— ${escapeHtml(formatAttribution(item))}</footer>
      </blockquote>`;
  }

  function renderDots(count, activeIndex) {
    return Array.from({ length: count }, (_, i) => (
      `<button type="button" class="testimonial-dot${i === activeIndex ? ' is-active' : ''}" data-index="${i}" aria-label="Show testimonial ${i + 1} of ${count}"${i === activeIndex ? ' aria-current="true"' : ''}></button>`
    )).join('');
  }

  async function initTestimonials(root) {
    if (!root || root.dataset.initialized === 'true') return;

    try {
      const res = await fetch('/testimonials.json');
      if (!res.ok) return;
      const data = await res.json();
      const items = data.testimonials || [];
      if (!items.length) return;

      root.dataset.initialized = 'true';
      root.innerHTML = `
        <div class="testimonial-carousel" aria-live="polite">
          <div class="testimonial-track">
            ${items.map((item, i) => renderSlide(item, i, items.length)).join('')}
          </div>
          ${items.length > 1 ? `
            <div class="testimonial-controls">
              <button type="button" class="testimonial-nav testimonial-nav--prev" aria-label="Previous testimonial">‹</button>
              <div class="testimonial-dots" role="tablist" aria-label="Testimonials">
                ${renderDots(items.length, 0)}
              </div>
              <button type="button" class="testimonial-nav testimonial-nav--next" aria-label="Next testimonial">›</button>
            </div>
          ` : ''}
        </div>`;

      if (items.length < 2) return;

      const slides = [...root.querySelectorAll('.testimonial-slide')];
      const dots = [...root.querySelectorAll('.testimonial-dot')];
      const prevBtn = root.querySelector('.testimonial-nav--prev');
      const nextBtn = root.querySelector('.testimonial-nav--next');
      let active = 0;
      let timer = null;

      function show(index) {
        active = (index + items.length) % items.length;
        slides.forEach((slide, i) => {
          const on = i === active;
          slide.classList.toggle('is-active', on);
          slide.hidden = !on;
        });
        dots.forEach((dot, i) => {
          const on = i === active;
          dot.classList.toggle('is-active', on);
          dot.setAttribute('aria-current', on ? 'true' : 'false');
        });
      }

      function next() {
        show(active + 1);
      }

      function prev() {
        show(active - 1);
      }

      function stopRotation() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      function startRotation() {
        stopRotation();
        if (prefersReducedMotion()) return;
        timer = setInterval(next, ROTATE_MS);
      }

      prevBtn?.addEventListener('click', () => {
        prev();
        startRotation();
      });

      nextBtn?.addEventListener('click', () => {
        next();
        startRotation();
      });

      dots.forEach((dot) => {
        dot.addEventListener('click', () => {
          show(Number(dot.dataset.index));
          startRotation();
        });
      });

      root.querySelector('.testimonial-carousel')?.addEventListener('mouseenter', stopRotation);
      root.querySelector('.testimonial-carousel')?.addEventListener('mouseleave', startRotation);
      root.querySelector('.testimonial-carousel')?.addEventListener('focusin', stopRotation);
      root.querySelector('.testimonial-carousel')?.addEventListener('focusout', startRotation);

      startRotation();
    } catch {
      // Keep static fallback content if fetch fails
    }
  }

  function boot() {
    document.querySelectorAll('[data-testimonials]').forEach(initTestimonials);
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.LaserGatorTestimonials = { init: initTestimonials };
})();
