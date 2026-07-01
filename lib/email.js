'use strict';

const nodemailer = require('nodemailer');

function getSmtpPassword() {
  return process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim() || '';
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = getSmtpPassword();

  if (!host || !portRaw || !user || !password) {
    return null;
  }

  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host,
    port,
    secure,
    user,
    password,
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_FROM?.trim() || user,
    fromName: process.env.SMTP_FROM_NAME?.trim() || 'LaserGator',
  };
}

function isEmailConfigured() {
  return getSmtpConfig() !== null;
}

function createTransport() {
  const config = getSmtpConfig();
  if (!config) return null;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

function getContactRecipients() {
  const raw = process.env.CONTACT_TO?.trim();
  if (raw) {
    return raw.split(',').map((address) => address.trim()).filter(Boolean);
  }
  return ['paul@laser-gator.com', 'milo@laser-gator.com'];
}

function buildFromAddress(config) {
  return `"${config.fromName}" <${config.fromEmail}>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildContactEmail(entry) {
  const textLines = [
    `Name: ${entry.name}`,
    `Email: ${entry.email}`,
    entry.eventDate ? `Event date: ${entry.eventDate}` : null,
    entry.venue ? `Venue: ${entry.venue}` : null,
    '',
    entry.message,
    '',
    `Submitted: ${entry.submittedAt}`,
  ].filter((line) => line !== null);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #222;">
      <h2 style="color: #333;">New LaserGator contact form submission</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px 12px 8px 0; vertical-align: top;"><strong>Name</strong></td><td>${escapeHtml(entry.name)}</td></tr>
        <tr><td style="padding: 8px 12px 8px 0; vertical-align: top;"><strong>Email</strong></td><td><a href="mailto:${escapeHtml(entry.email)}">${escapeHtml(entry.email)}</a></td></tr>
        ${entry.eventDate ? `<tr><td style="padding: 8px 12px 8px 0; vertical-align: top;"><strong>Event date</strong></td><td>${escapeHtml(entry.eventDate)}</td></tr>` : ''}
        ${entry.venue ? `<tr><td style="padding: 8px 12px 8px 0; vertical-align: top;"><strong>Venue</strong></td><td>${escapeHtml(entry.venue)}</td></tr>` : ''}
      </table>
      <p><strong>Message</strong></p>
      <p style="white-space: pre-wrap; background: #f5f5f5; padding: 16px; border-radius: 8px;">${escapeHtml(entry.message)}</p>
      <p style="color: #666; font-size: 12px;">Submitted ${escapeHtml(entry.submittedAt)} via laser-gator.com</p>
    </div>
  `;

  return {
    text: textLines.join('\n'),
    html,
  };
}

async function sendContactEmail(entry) {
  const config = getSmtpConfig();
  if (!config) {
    return { success: false, error: 'Email is not configured.' };
  }

  const transport = createTransport();
  if (!transport) {
    return { success: false, error: 'Failed to create email transport.' };
  }

  const { text, html } = buildContactEmail(entry);

  try {
    const result = await transport.sendMail({
      from: buildFromAddress(config),
      to: getContactRecipients().join(', '),
      replyTo: entry.email,
      subject: `LaserGator inquiry from ${entry.name}`,
      text,
      html,
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send contact email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email',
    };
  }
}

async function verifySmtpConnection() {
  const config = getSmtpConfig();
  if (!config) {
    return {
      success: false,
      error: 'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD (or SMTP_PASS).',
    };
  }

  const transport = createTransport();
  if (!transport) {
    return { success: false, error: 'Failed to create email transport.' };
  }

  try {
    await transport.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to SMTP server',
    };
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function logEmailMode() {
  if (isEmailConfigured()) {
    const config = getSmtpConfig();
    console.log(`Contact email: SMTP ${config.host}:${config.port} → ${getContactRecipients().join(', ')}`);
    return;
  }

  if (isProduction()) {
    console.warn('WARNING: SMTP is not configured — contact form submissions are logged only.');
    return;
  }

  console.log('Contact email: not configured (submissions log to data/contact-log.json only)');
}

module.exports = {
  isEmailConfigured,
  sendContactEmail,
  verifySmtpConnection,
  logEmailMode,
};
