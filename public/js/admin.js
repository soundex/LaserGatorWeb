(function () {
  const TOKEN_KEY = 'lg_admin_token';
  const loginView = document.getElementById('admin-login');
  const panelView = document.getElementById('admin-panel');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (!loginView) return;

  if (getToken()) {
    showPanel();
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('login-status');
    const password = document.getElementById('admin-password').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem(TOKEN_KEY, data.token);
      showPanel();
    } catch (err) {
      status.textContent = err.message;
      status.className = 'admin-status error';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    loginView.style.display = 'block';
    panelView.style.display = 'none';
  });

  initTabs();
  initUpload();
  initMediaLibrary();
  initEventsEditor();

  function showPanel() {
    loginView.style.display = 'none';
    panelView.style.display = 'block';
    loadMediaLibrary();
    loadEventsList();
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  }

  function initUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    const meta = document.getElementById('upload-meta');
    const form = document.getElementById('upload-form');
    const progress = document.getElementById('upload-progress');
    const fill = document.getElementById('progress-fill');
    const status = document.getElementById('upload-status');
    let selectedFile = null;

    zone?.addEventListener('click', () => input.click());
    zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone?.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
    });
    input?.addEventListener('change', () => {
      if (input.files[0]) selectFile(input.files[0]);
    });

    function selectFile(file) {
      selectedFile = file;
      meta.classList.add('visible');
      document.getElementById('selected-file').textContent = file.name;
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedFile) return;

      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', document.getElementById('upload-title').value);
      fd.append('category', document.getElementById('upload-category').value);
      fd.append('eventTag', document.getElementById('upload-tag').value);

      progress.classList.add('visible');
      fill.style.width = '30%';
      status.textContent = 'Uploading…';
      status.className = 'admin-status';

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            fill.style.width = `${Math.round((ev.loaded / ev.total) * 90)}%`;
          }
        };

        const result = await new Promise((resolve, reject) => {
          xhr.onload = () => {
            try {
              resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) });
            } catch {
              reject(new Error('Invalid response'));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(fd);
        });

        if (result.status >= 400) throw new Error(result.data.error || 'Upload failed');

        fill.style.width = '100%';
        status.textContent = 'Upload complete!';
        status.className = 'admin-status success';
        form.reset();
        meta.classList.remove('visible');
        selectedFile = null;
        loadMediaLibrary();
      } catch (err) {
        status.textContent = err.message;
        status.className = 'admin-status error';
      } finally {
        setTimeout(() => {
          progress.classList.remove('visible');
          fill.style.width = '0%';
        }, 1500);
      }
    });
  }

  async function loadMediaLibrary() {
    const list = document.getElementById('media-library');
    if (!list) return;

    try {
      const res = await fetch('/data/media-manifest.json');
      const data = await res.json();
      const items = [
        ...data.images.map((i) => ({ ...i, type: 'image' })),
        ...data.videos.map((v) => ({ ...v, type: 'video' })),
      ];

      if (!items.length) {
        list.innerHTML = '<p class="admin-status">No media uploaded yet.</p>';
        return;
      }

      list.innerHTML = items.map((item) => `
        <div class="media-row">
          <div class="media-row-info">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${item.type} · ${item.category}${item.eventTag ? ` · ${item.eventTag}` : ''}</span>
          </div>
          <button class="btn-danger" data-delete-media="${item.id}">Delete</button>
        </div>`).join('');

      list.querySelectorAll('[data-delete-media]').forEach((btn) => {
        btn.addEventListener('click', () => deleteMedia(btn.dataset.deleteMedia));
      });
    } catch {
      list.innerHTML = '<p class="admin-status error">Could not load media.</p>';
    }
  }

  async function deleteMedia(id) {
    if (!confirm('Delete this media item?')) return;
    const res = await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) loadMediaLibrary();
    else alert('Delete failed.');
  }

  function initEventsEditor() {
    const form = document.getElementById('event-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('event-status');
      const event = {
        id: document.getElementById('event-id').value || undefined,
        title: document.getElementById('event-title').value,
        startAt: document.getElementById('event-start').value,
        venue: document.getElementById('event-venue').value,
        description: document.getElementById('event-description').value,
        ticketUrl: document.getElementById('event-tickets').value,
        isFeatured: document.getElementById('event-featured').checked,
        status: document.getElementById('event-status-select').value,
      };

      try {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        status.textContent = 'Event saved!';
        status.className = 'admin-status success';
        form.reset();
        document.getElementById('event-id').value = '';
        loadEventsList();
      } catch (err) {
        status.textContent = err.message;
        status.className = 'admin-status error';
      }
    });
  }

  async function loadEventsList() {
    const list = document.getElementById('events-list');
    if (!list) return;

    try {
      const res = await fetch('/data/events.json');
      const data = await res.json();

      if (!data.events?.length) {
        list.innerHTML = '<p class="admin-status">No events yet.</p>';
        return;
      }

      list.innerHTML = data.events.map((event) => `
        <div class="media-row">
          <div class="media-row-info">
            <strong>${escapeHtml(event.title)}</strong>
            <span>${event.startAt}${event.venue ? ` · ${event.venue}` : ''}</span>
          </div>
          <div>
            <button class="btn btn-outline" data-edit-event='${JSON.stringify(event).replace(/'/g, '&#39;')}'>Edit</button>
            <button class="btn-danger" data-delete-event="${event.id}">Delete</button>
          </div>
        </div>`).join('');

      list.querySelectorAll('[data-edit-event]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const event = JSON.parse(btn.dataset.editEvent);
          document.getElementById('event-id').value = event.id;
          document.getElementById('event-title').value = event.title;
          document.getElementById('event-start').value = toDatetimeLocal(event.startAt);
          document.getElementById('event-venue').value = event.venue || '';
          document.getElementById('event-description').value = event.description || '';
          document.getElementById('event-tickets').value = event.ticketUrl || '';
          document.getElementById('event-featured').checked = event.isFeatured;
          document.getElementById('event-status-select').value = event.status || 'upcoming';
          document.querySelector('[data-tab="tab-events"]').click();
        });
      });

      list.querySelectorAll('[data-delete-event]').forEach((btn) => {
        btn.addEventListener('click', () => deleteEvent(btn.dataset.deleteEvent));
      });
    } catch {
      list.innerHTML = '<p class="admin-status error">Could not load events.</p>';
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) loadEventsList();
    else alert('Delete failed.');
  }

  function toDatetimeLocal(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function initMediaLibrary() {
    /* loaded on panel show */
  }
})();
