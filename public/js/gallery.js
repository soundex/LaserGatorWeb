(function () {
  const PAGE_SIZE = 24;
  let allItems = [];
  let filtered = [];
  let visibleCount = PAGE_SIZE;
  let activeFilter = 'all';

  const grid = document.getElementById('gallery-grid');
  const filters = document.getElementById('filter-bar');
  const loadMoreBtn = document.getElementById('load-more');
  const lightbox = document.getElementById('lightbox');

  if (!grid) return;

  init();

  async function init() {
    grid.innerHTML = '<p class="gallery-loading">Loading gallery…</p>';
    try {
      const res = await fetch('/data/media-manifest.json');
      const data = await res.json();
      allItems = [
        ...data.images.map((i) => ({ ...i, type: 'image' })),
        ...data.videos.map((v) => ({ ...v, type: 'video' })),
      ].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      buildFilters(data);
      applyFilter('all');
    } catch {
      grid.innerHTML = '<p class="gallery-empty">Could not load gallery. Please try again later.</p>';
    }
  }

  function buildFilters(data) {
    if (!filters) return;
    const tags = new Set();
    [...data.images, ...data.videos].forEach((item) => {
      if (item.eventTag) tags.add(item.eventTag);
    });

    const tagButtons = [...tags].map(
      (tag) => `<button class="filter-btn" data-filter="tag:${tag}">${tag}</button>`
    ).join('');

    filters.innerHTML = `
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="image">Images</button>
      <button class="filter-btn" data-filter="video">Videos</button>
      ${tagButtons}`;

    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filters.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  }

  function applyFilter(filter) {
    activeFilter = filter;
    visibleCount = PAGE_SIZE;

    if (filter === 'all') {
      filtered = allItems;
    } else if (filter === 'image' || filter === 'video') {
      filtered = allItems.filter((i) => i.type === filter);
    } else if (filter.startsWith('tag:')) {
      const tag = filter.slice(4);
      filtered = allItems.filter((i) => i.eventTag === tag);
    }

    render();
  }

  function render() {
    const slice = filtered.slice(0, visibleCount);

    if (!slice.length) {
      grid.innerHTML = '<p class="gallery-empty">No media yet — check back soon!</p>';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    grid.innerHTML = slice.map((item, idx) => renderItem(item, idx)).join('');
    grid.querySelectorAll('.gallery-item').forEach((el) => {
      el.addEventListener('click', () => openLightbox(el.dataset));
    });

    if (loadMoreBtn) {
      loadMoreBtn.style.display = visibleCount < filtered.length ? 'inline-flex' : 'none';
    }
  }

  function renderItem(item, idx) {
    const src = item.type === 'image'
      ? `/media/images/${item.thumbnail || item.filename}`
      : item.poster
        ? `/media/images/${item.poster}`
        : '';

    const imgTag = src
      ? `<img src="${src}" alt="${escapeHtml(item.title)}" loading="lazy">`
      : `<div style="width:100%;height:100%;background:var(--bg-elevated)"></div>`;

    const videoBadge = item.type === 'video' ? '<div class="video-badge"></div>' : '';

    return `
      <article class="gallery-item fade-in" style="transition-delay:${(idx % 12) * 50}ms"
        data-type="${item.type}"
        data-filename="${item.filename}"
        data-title="${escapeHtml(item.title)}">
        ${imgTag}
        ${videoBadge}
        <div class="item-overlay">
          <span class="item-type">${item.type}</span>
          <span class="item-title">${escapeHtml(item.title)}</span>
        </div>
      </article>`;
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      render();
      document.querySelectorAll('.fade-in:not(.visible)').forEach((el) => {
        requestAnimationFrame(() => el.classList.add('visible'));
      });
    });
  }

  function openLightbox(dataset) {
    if (!lightbox) return;
    const content = lightbox.querySelector('.lightbox-content');
    const caption = lightbox.querySelector('.lightbox-caption');

    if (dataset.type === 'image') {
      content.innerHTML = `<img src="/media/images/${dataset.filename}" alt="${dataset.title}">`;
    } else {
      content.innerHTML = `<video src="/media/videos/${dataset.filename}" controls autoplay></video>`;
    }
    caption.textContent = dataset.title;

    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  if (lightbox) {
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  function closeLightbox() {
    if (!lightbox) return;
    const video = lightbox.querySelector('video');
    if (video) video.pause();
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
})();
