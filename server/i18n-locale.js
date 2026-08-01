'use strict';

const SUPPORTED_LOCALES = Object.freeze(['en', 'ja', 'zh-CN', 'ko', 'es', 'vi']);
const SUPPORTED_SET = new Set(SUPPORTED_LOCALES);

function normalizeLocale(value, fallback = 'en') {
  const raw = String(value || '').trim().replace('_', '-');
  if (!raw) return SUPPORTED_SET.has(fallback) ? fallback : 'en';
  const lower = raw.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-cn-')) return 'zh-CN';
  if (lower === 'jp' || lower === 'ja-jp' || lower.startsWith('ja-')) return 'ja';
  if (lower === 'kr' || lower === 'ko-kr' || lower.startsWith('ko-')) return 'ko';
  if (lower.startsWith('es-')) return 'es';
  if (lower.startsWith('vi-')) return 'vi';
  if (lower.startsWith('en-')) return 'en';
  return SUPPORTED_SET.has(raw) ? raw : (SUPPORTED_SET.has(lower) ? lower : (SUPPORTED_SET.has(fallback) ? fallback : 'en'));
}

function requestLocale(req) {
  const explicit = req?.query?.locale || req?.body?.locale || req?.headers?.['x-app-locale'];
  if (explicit) return normalizeLocale(explicit);
  const accept = String(req?.headers?.['accept-language'] || '').split(',')[0];
  return normalizeLocale(accept);
}

module.exports = { SUPPORTED_LOCALES, normalizeLocale, requestLocale };
