(function () {
  const upcomingEl = document.getElementById('upcoming-events');
  const pastSection = document.getElementById('past-events-section');
  const pastList = document.getElementById('past-events-list');
  const emptyEl = document.getElementById('events-empty');
  const pastToggle = document.getElementById('past-toggle');

  if (!upcomingEl) return;

  init();

  async function init() {
    try {
      const res = await fetch('/data/events.json');
      const data = await res.json();
      const now = new Date();

      const upcoming = [];
      const past = [];

      (data.events || []).forEach((event) => {
        const date = new Date(event.startAt);
        if (event.status === 'past' || date < now) {
          past.push(event);
        } else {
          upcoming.push(event);
        }
      });

      upcoming.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      past.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));

      if (!upcoming.length && !past.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        upcomingEl.innerHTML = '';
        if (pastSection) pastSection.style.display = 'none';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';

      if (upcoming.length) {
        upcomingEl.innerHTML = upcoming.map(renderCard).join('');
      } else {
        upcomingEl.innerHTML = '<p class="events-empty">No upcoming events right now. Check back soon!</p>';
      }

      if (past.length && pastList) {
        pastList.innerHTML = past.map(renderPastItem).join('');
      } else if (pastSection) {
        pastSection.style.display = 'none';
      }
    } catch {
      upcomingEl.innerHTML = '<p class="events-empty">Could not load events.</p>';
    }
  }

  if (pastToggle) {
    pastToggle.addEventListener('click', () => {
      pastList.classList.toggle('open');
      pastToggle.textContent = pastList.classList.contains('open')
        ? 'Hide Past Events'
        : 'Show Past Events';
    });
  }

  function renderCard(event) {
    const featured = event.isFeatured ? ' featured' : '';
    const ticket = event.ticketUrl
      ? `<a href="${event.ticketUrl}" class="btn btn-primary" target="_blank" rel="noopener">Get Tickets</a>`
      : '';

    return `
      <article class="card event-card${featured} fade-in">
        <div class="event-date">${formatDate(event.startAt)}</div>
        <h3>${escapeHtml(event.title)}</h3>
        ${event.venue ? `<div class="event-venue">${escapeHtml(event.venue)}</div>` : ''}
        ${event.description ? `<p class="event-desc">${escapeHtml(event.description)}</p>` : ''}
        <div class="event-actions">${ticket}</div>
      </article>`;
  }

  function renderPastItem(event) {
    return `
      <div class="past-event-item">
        <span class="past-title">${escapeHtml(event.title)}</span>
        <span class="past-date">${formatDate(event.startAt)}${event.venue ? ` — ${escapeHtml(event.venue)}` : ''}</span>
      </div>`;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
})();
