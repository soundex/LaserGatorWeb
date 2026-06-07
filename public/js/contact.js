(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('form-status');
    const payload = {
      name: form.name.value,
      email: form.email.value,
      eventDate: form.eventDate.value,
      venue: form.venue.value,
      message: form.message.value,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      status.textContent = data.message;
      status.className = 'form-status success';
      form.reset();
    } catch (err) {
      status.textContent = err.message;
      status.className = 'form-status error';
    }
  });
})();
