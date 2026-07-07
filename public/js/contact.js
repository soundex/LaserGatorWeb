(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(message, type) {
    if (!status) return;
    status.textContent = message;
    status.className = type ? `form-status ${type}` : 'form-status';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      eventDate: form.elements.eventDate.value,
      venue: form.elements.venue.value.trim(),
      message: form.elements.message.value.trim(),
    };

    if (submitBtn) submitBtn.disabled = true;
    setStatus('Sending…', 'loading');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Could not send message. Please call us directly.');
      }

      setStatus(data.message || 'Thank you! We will be in touch soon.', 'success');
      form.reset();
    } catch (err) {
      setStatus(err.message || 'Could not send message. Please call us directly.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
