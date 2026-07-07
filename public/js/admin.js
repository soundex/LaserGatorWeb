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
  initContentBundle();
  initEmailDiagnostics();

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
        if (btn.dataset.tab === 'tab-email') {
          loadEmailDiagnostics();
        }
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
        ...(data.images || []).map((i) => ({ ...i, type: 'image' })),
        ...(data.videos || []).map((v) => ({ ...v, type: 'video' })),
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

  function initContentBundle() {
    const exportBtn = document.getElementById('export-btn');
    const exportStatus = document.getElementById('export-status');
    const importForm = document.getElementById('import-form');
    const importMode = document.getElementById('import-mode');
    const importConfirmGroup = document.getElementById('import-confirm-group');
    const importStatus = document.getElementById('import-status');

    importMode?.addEventListener('change', () => {
      importConfirmGroup.style.display = importMode.value === 'replace' ? 'block' : 'none';
    });

    exportBtn?.addEventListener('click', async () => {
      exportStatus.textContent = 'Preparing export…';
      exportStatus.className = 'admin-status';
      try {
        const res = await fetch('/api/admin/export', { headers: authHeaders() });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Export failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lasergator-content-${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        exportStatus.textContent = 'Export downloaded.';
        exportStatus.className = 'admin-status success';
      } catch (err) {
        exportStatus.textContent = err.message;
        exportStatus.className = 'admin-status error';
      }
    });

    importForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('import-file');
      const file = fileInput.files[0];
      if (!file) return;

      const mode = importMode.value;
      const fd = new FormData();
      fd.append('bundle', file);
      fd.append('mode', mode);
      if (mode === 'replace') {
        fd.append('confirm', document.getElementById('import-confirm').value);
      }

      importStatus.textContent = 'Importing…';
      importStatus.className = 'admin-status';

      try {
        const res = await fetch('/api/admin/import', {
          method: 'POST',
          headers: authHeaders(),
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');

        const r = data.report;
        importStatus.textContent = `Import complete (${r.mode}). Media copied: ${r.mediaReport.copied}, skipped: ${r.mediaReport.skipped}. Pruned: ${r.pruneReport.removed}.`;
        importStatus.className = 'admin-status success';
        importForm.reset();
        importConfirmGroup.style.display = 'none';
        loadMediaLibrary();
        loadEventsList();
      } catch (err) {
        importStatus.textContent = err.message;
        importStatus.className = 'admin-status error';
      }
    });
  }

  function initEmailDiagnostics() {
    const verifyBtn = document.getElementById('email-verify-btn');
    const testBtn = document.getElementById('email-test-btn');
    const refreshBtn = document.getElementById('email-log-refresh');
    const actionStatus = document.getElementById('email-action-status');
    const testTo = document.getElementById('email-test-to');

    verifyBtn?.addEventListener('click', async () => {
      actionStatus.textContent = 'Verifying SMTP connection…';
      actionStatus.className = 'admin-status';
      verifyBtn.disabled = true;
      try {
        const res = await fetch('/api/admin/email/verify', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'SMTP verification failed');
        }
        actionStatus.textContent = 'SMTP connection verified successfully.';
        actionStatus.className = 'admin-status success';
        await loadEmailDiagnostics();
      } catch (err) {
        actionStatus.textContent = err.message;
        actionStatus.className = 'admin-status error';
        await loadEmailLog();
      } finally {
        verifyBtn.disabled = false;
      }
    });

    testBtn?.addEventListener('click', async () => {
      actionStatus.textContent = 'Sending test email…';
      actionStatus.className = 'admin-status';
      testBtn.disabled = true;
      try {
        const body = {};
        if (testTo?.value.trim()) body.to = testTo.value.trim();
        const res = await fetch('/api/admin/email/test', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Test email failed');
        }
        actionStatus.textContent = `Test email sent${data.messageId ? ` (${data.messageId})` : ''}.`;
        actionStatus.className = 'admin-status success';
        await loadEmailDiagnostics();
      } catch (err) {
        actionStatus.textContent = err.message;
        actionStatus.className = 'admin-status error';
        await loadEmailLog();
      } finally {
        testBtn.disabled = false;
      }
    });

    refreshBtn?.addEventListener('click', () => loadEmailDiagnostics());
  }

  async function loadEmailDiagnostics() {
    await Promise.all([loadEmailStatus(), loadEmailLog()]);
  }

  async function loadEmailStatus() {
    const grid = document.getElementById('email-status-grid');
    if (!grid) return;
    grid.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
    try {
      const res = await fetch('/api/admin/email/status', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load email status');
      grid.innerHTML = renderEmailStatus(data.diagnostics);
    } catch (err) {
      grid.innerHTML = `<p class="admin-status error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderEmailStatus(d) {
    const configuredClass = d.configured ? 'email-badge-ok' : 'email-badge-warn';
    const configuredLabel = d.configured ? 'Configured' : 'Not configured';

    let html = `
      <div class="email-status-item">
        <span class="email-status-label">Status</span>
        <span class="email-badge ${configuredClass}">${configuredLabel}</span>
      </div>
      <div class="email-status-item">
        <span class="email-status-label">Nodemailer</span>
        <span>${escapeHtml(d.nodemailerVersion)}</span>
      </div>
      <div class="email-status-item">
        <span class="email-status-label">Contact recipients</span>
        <span>${escapeHtml((d.contactTo || []).join(', '))}</span>
      </div>
    `;

    if (d.missingVars?.length) {
      html += `
        <div class="email-status-item email-status-full">
          <span class="email-status-label">Missing variables</span>
          <span class="email-missing">${escapeHtml(d.missingVars.join(', '))}</span>
        </div>
      `;
    }

    if (d.smtp) {
      html += `
        <div class="email-status-item">
          <span class="email-status-label">SMTP host</span>
          <span>${escapeHtml(d.smtp.host)}:${d.smtp.port}</span>
        </div>
        <div class="email-status-item">
          <span class="email-status-label">Secure</span>
          <span>${d.smtp.secure ? 'Yes' : 'No (STARTTLS)'}</span>
        </div>
        <div class="email-status-item">
          <span class="email-status-label">SMTP user</span>
          <span>${escapeHtml(d.smtp.user)}</span>
        </div>
        <div class="email-status-item">
          <span class="email-status-label">From</span>
          <span>${escapeHtml(d.smtp.fromName)} &lt;${escapeHtml(d.smtp.fromEmail)}&gt;</span>
        </div>
      `;
    }

    return html;
  }

  async function loadEmailLog() {
    const container = document.getElementById('email-log');
    if (!container) return;
    try {
      const res = await fetch('/api/admin/email/log', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load email log');
      container.innerHTML = renderEmailLog(data.log || []);
    } catch (err) {
      container.innerHTML = `<p class="admin-status error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderEmailLog(entries) {
    if (!entries.length) {
      return '<p style="color:var(--text-muted)">No email events logged yet.</p>';
    }

    const rows = entries.map((entry) => {
      const ok = entry.success;
      const badgeClass = ok ? 'email-badge-ok' : 'email-badge-warn';
      const badgeLabel = ok ? 'OK' : 'Failed';
      const detail = entry.error
        || entry.detail
        || (entry.messageId ? `Message ID: ${entry.messageId}` : '')
        || (entry.to ? `To: ${Array.isArray(entry.to) ? entry.to.join(', ') : entry.to}` : '');

      return `
        <div class="email-log-entry">
          <div class="email-log-meta">
            <span class="email-badge ${badgeClass}">${badgeLabel}</span>
            <span class="email-log-type">${escapeHtml(entry.type || 'event')}</span>
            <span class="email-log-time">${escapeHtml(formatLogTime(entry.at))}</span>
          </div>
          ${detail ? `<p class="email-log-detail">${escapeHtml(detail)}</p>` : ''}
        </div>
      `;
    }).join('');

    return rows;
  }

  function formatLogTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
})();
