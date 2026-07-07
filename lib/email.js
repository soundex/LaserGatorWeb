'use strict';

const nodemailer = require('nodemailer');

let logAppender = null;

function setEmailLogAppender(fn) {
  logAppender = typeof fn === 'function' ? fn : null;
}

async function recordEmailEvent(event) {
  if (!logAppender) return;
  try {
    await logAppender({
      ...event,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write email log:', err);
  }
}

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

function getMissingSmtpVars() {
  const missing = [];
  if (!process.env.SMTP_HOST?.trim()) missing.push('SMTP_HOST');
  if (!process.env.SMTP_PORT?.trim()) missing.push('SMTP_PORT');
  if (!process.env.SMTP_USER?.trim()) missing.push('SMTP_USER');
  if (!getSmtpPassword()) missing.push('SMTP_PASSWORD or SMTP_PASS');
  return missing;
}

function maskEmail(address) {
  if (!address) return '';
  const [local, domain] = address.split('@');
  if (!domain) return '***';
  const visible = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${visible}@${domain}`;
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
    ...(config.port === 587 && !config.secure ? { requireTLS: true } : {}),
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

function getDiagnostics() {
  const config = getSmtpConfig();
  const missing = getMissingSmtpVars();

  return {
    configured: isEmailConfigured(),
    nodemailerVersion: nodemailer.version || 'installed',
    missingVars: missing,
    smtp: config
      ? {
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: maskEmail(config.user),
          fromEmail: config.fromEmail,
          fromName: config.fromName,
        }
      : null,
    contactTo: getContactRecipients(),
    envHints: {
      smtpFromSet: Boolean(process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_FROM?.trim()),
      smtpSecure: process.env.SMTP_SECURE || '(auto from port)',
    },
  };
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

async function sendMailMessage({ to, subject, text, html, replyTo, type }) {
  const config = getSmtpConfig();
  if (!config) {
    const error = 'Email is not configured.';
    await recordEmailEvent({ type, success: false, error, to });
    return { success: false, error };
  }

  const transport = createTransport();
  if (!transport) {
    const error = 'Failed to create email transport.';
    await recordEmailEvent({ type, success: false, error, to });
    return { success: false, error };
  }

  try {
    const result = await transport.sendMail({
      from: buildFromAddress(config),
      to: Array.isArray(to) ? to.join(', ') : to,
      replyTo,
      subject,
      text,
      html,
    });

    await recordEmailEvent({
      type,
      success: true,
      to: Array.isArray(to) ? to : [to],
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error sending email';
    console.error(`Failed to send ${type} email:`, error);
    await recordEmailEvent({ type, success: false, error: message, to: Array.isArray(to) ? to : [to] });
    return { success: false, error: message };
  }
}

async function sendContactEmail(entry) {
  const { text, html } = buildContactEmail(entry);
  return sendMailMessage({
    to: getContactRecipients(),
    replyTo: entry.email,
    subject: `LaserGator inquiry from ${entry.name}`,
    text,
    html,
    type: 'contact',
  });
}

async function sendTestEmail(to) {
  const recipients = to?.trim() ? [to.trim()] : getContactRecipients();
  const stamp = new Date().toISOString();
  const text = [
    'This is a LaserGator admin test email.',
    '',
    `Sent: ${stamp}`,
    'If you received this, SMTP is configured correctly on your deployment.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #222;">
      <h2 style="color: #333;">LaserGator SMTP test</h2>
      <p>This is a test email from the LaserGator admin panel.</p>
      <p><strong>Sent:</strong> ${escapeHtml(stamp)}</p>
      <p>If you received this, SMTP is configured correctly on your deployment.</p>
    </div>
  `;

  return sendMailMessage({
    to: recipients,
    subject: 'LaserGator SMTP test email',
    text,
    html,
    type: 'test',
  });
}

async function verifySmtpConnection() {
  const config = getSmtpConfig();
  if (!config) {
    const error = 'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD (or SMTP_PASS).';
    await recordEmailEvent({ type: 'verify', success: false, error });
    return { success: false, error };
  }

  const transport = createTransport();
  if (!transport) {
    const error = 'Failed to create email transport.';
    await recordEmailEvent({ type: 'verify', success: false, error });
    return { success: false, error };
  }

  try {
    await transport.verify();
    await recordEmailEvent({ type: 'verify', success: true });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect to SMTP server';
    await recordEmailEvent({ type: 'verify', success: false, error: message });
    return { success: false, error: message };
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function logEmailMode() {
  if (isEmailConfigured()) {
    const config = getSmtpConfig();
    console.log(`Contact email: SMTP ${config.host}:${config.port} → ${getContactRecipients().join(', ')}`);
    recordEmailEvent({ type: 'startup', success: true, detail: 'SMTP configured at server start' });
    return;
  }

  if (isProduction()) {
    console.warn('WARNING: SMTP is not configured — contact form submissions are logged only.');
    recordEmailEvent({ type: 'startup', success: false, error: 'SMTP not configured in production' });
    return;
  }

  console.log('Contact email: not configured (submissions log to data/contact-log.json only)');
  recordEmailEvent({ type: 'startup', success: false, detail: 'SMTP not configured (development)' });
}

module.exports = {
  setEmailLogAppender,
  isEmailConfigured,
  getDiagnostics,
  sendContactEmail,
  sendTestEmail,
  verifySmtpConnection,
  logEmailMode,
};
