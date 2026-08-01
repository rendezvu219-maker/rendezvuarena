const crypto = require('node:crypto');
const { isProduction } = require('./security');

const memoryMailbox = new Map();

function deliveryMode() {
  const configured = String(process.env.EMAIL_DELIVERY_MODE || '').trim().toLowerCase();
  if (configured) return configured;
  return process.env.RESEND_API_KEY ? 'resend' : (process.env.NODE_ENV === 'test' ? 'memory' : 'disabled');
}

function emailFrom() {
  return String(process.env.EMAIL_FROM || '').trim();
}

function assertEmailConfiguration() {
  const mode = deliveryMode();
  if (mode === 'resend') {
    if (!String(process.env.RESEND_API_KEY || '').trim()) throw new Error('RESEND_API_KEY is required for email delivery.');
    if (!emailFrom()) throw new Error('EMAIL_FROM is required for email delivery.');
  }
  if (isProduction && mode !== 'resend') throw new Error('Production email delivery must use Resend.');
  return mode;
}

function renderVerificationEmail({ code, locale = 'en' }) {
  const isVietnamese = String(locale).toLowerCase().startsWith('vi');
  const subject = isVietnamese
    ? 'Mã xác minh tài khoản RendezVu Arena'
    : 'Verify your RendezVu Arena account';
  const heading = isVietnamese ? 'Xác minh email' : 'Email verification';
  const intro = isVietnamese ? 'Mã xác minh của bạn là:' : 'Your verification code is:';
  const expiry = isVietnamese ? 'Mã này hết hạn sau 10 phút.' : 'This code expires in 10 minutes.';
  const ignore = isVietnamese
    ? 'Nếu bạn không tạo tài khoản này, hãy bỏ qua email.'
    : 'If you did not create this account, you can ignore this email.';
  return {
    subject,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:24px"><div style="max-width:520px;margin:auto;background:white;border-radius:12px;padding:28px"><h2>${heading}</h2><p>${intro}</p><p style="font-size:32px;font-weight:700;letter-spacing:7px">${code}</p><p>${expiry}</p><p style="color:#666">${ignore}</p></div></body></html>`,
  };
}


function renderEmailChangeVerification({ code, locale = 'en' }) {
  const isVietnamese = String(locale).toLowerCase().startsWith('vi');
  const subject = isVietnamese
    ? 'Xác nhận địa chỉ email mới — RendezVu Arena'
    : 'Confirm your new RendezVu Arena email';
  const heading = isVietnamese ? 'Xác nhận email mới' : 'Confirm your new email';
  const intro = isVietnamese ? 'Mã xác nhận thay đổi email của bạn là:' : 'Your email-change confirmation code is:';
  const expiry = isVietnamese ? 'Mã này hết hạn sau 10 phút.' : 'This code expires in 10 minutes.';
  const ignore = isVietnamese
    ? 'Nếu bạn không yêu cầu thay đổi email, hãy bỏ qua thư này và đổi mật khẩu nếu cần.'
    : 'If you did not request this change, ignore this message and change your password if needed.';
  return {
    subject,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:24px"><div style="max-width:520px;margin:auto;background:white;border-radius:12px;padding:28px"><h2>${heading}</h2><p>${intro}</p><p style="font-size:32px;font-weight:700;letter-spacing:7px">${code}</p><p>${expiry}</p><p style="color:#666">${ignore}</p></div></body></html>`,
  };
}

async function deliverMessage({ email, message, code, idempotencyKey = '' }) {
  const mode = assertEmailConfiguration();
  if (mode === 'memory') {
    memoryMailbox.set(String(email).toLowerCase(), { ...message, code, deliveredAt: new Date().toISOString() });
    return { id: `memory_${crypto.randomBytes(8).toString('hex')}` };
  }
  if (mode === 'disabled') throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(process.env.RESEND_API_KEY)}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: emailFrom(), to: [email], subject: message.subject, html: message.html }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Email provider rejected the request (${response.status}).`);
  return payload;
}

async function sendVerificationEmail({ email, code, locale = 'en', idempotencyKey = '' }) {
  return deliverMessage({ email, code, idempotencyKey, message: renderVerificationEmail({ code, locale }) });
}

async function sendEmailChangeVerification({ email, code, locale = 'en', idempotencyKey = '' }) {
  return deliverMessage({ email, code, idempotencyKey, message: renderEmailChangeVerification({ code, locale }) });
}

function readMemoryEmail(email) {
  if (process.env.NODE_ENV !== 'test') return null;
  return memoryMailbox.get(String(email || '').toLowerCase()) || null;
}

module.exports = { assertEmailConfiguration, readMemoryEmail, sendEmailChangeVerification, sendVerificationEmail };
