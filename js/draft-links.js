// Keep repository prefixes and never mix server-backed and P2P room links.
import { t } from './i18n.js?v=0.7.4-link-check';
export const DRAFT_LINK_VERSION = '0.7.4-link-check';

export function readDraftRoomLink(value) {
  const url = new URL(value);
  const fragment = new URLSearchParams(url.hash.slice(1));
  // Read the complete invitation from one place. Never combine credentials
  // belonging to different rooms in the query and fragment.
  const fields = fragment.has('room') ? fragment : url.searchParams;
  return {
    roomCode: fields.get('room') || '',
    role: fields.get('role') || '',
    accessToken: fields.get('access') || '',
    hostParam: fields.get('host') || '',
  };
}

export function validateDraftRoomLink(link) {
  if (!link.roomCode) throw new Error(t('draftInviteMissingRoom'));
  if (!link.accessToken) throw new Error(t('draftInviteMissingAccess'));
  if (link.hostParam && !['host', 'teamA', 'teamB', 'broadcaster'].includes(link.role)) {
    throw new Error(t('draftInviteInvalidRole'));
  }
  return link;
}

export function p2pDraftLinks(baseUrl, roomCode, hostPeerId, access) {
  return Object.fromEntries(['host', 'teamA', 'teamB', 'broadcaster'].map(role => {
    validateDraftRoomLink({ roomCode, role, hostParam:hostPeerId, accessToken:access?.[role] });
    const url = new URL(role === 'broadcaster' ? 'broadcast.html' : 'draft-room.html', baseUrl);
    url.search = '';
    url.searchParams.set('v', DRAFT_LINK_VERSION);
    url.hash = new URLSearchParams({ room:roomCode, role, access:access[role], host:hostPeerId }).toString();
    return [role, url.href];
  }));
}

const copyFeedbackTimers = new WeakMap();

export async function copyDraftLink(input, button, clipboard = globalThis.navigator?.clipboard) {
  clearTimeout(copyFeedbackTimers.get(button));
  const label = button.textContent;
  try {
    validateDraftRoomLink(readDraftRoomLink(input.value));
  } catch (error) {
    button.textContent = 'INVALID LINK';
    button.title = error.message;
    globalThis.alert?.(error.message);
    return false;
  }
  let copied = false;
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(input.value);
      copied = true;
    }
  } catch { /* Some browsers deny Clipboard API access. Try selected text. */ }
  if (!copied) {
    input.focus();
    input.select();
    try { copied = input.ownerDocument.execCommand('copy') === true; } catch {}
  }
  if (!copied) {
    button.textContent = 'PRESS CTRL+C';
    button.title = t('draftInviteCopyBlocked');
    globalThis.alert?.(button.title);
    return false;
  }
  button.textContent = 'COPIED';
  button.title = t('draftInviteCopied');
  copyFeedbackTimers.set(button, setTimeout(() => {
    button.textContent = ['PRESS CTRL+C', 'INVALID LINK', 'COPIED'].includes(label) ? 'COPY' : label;
    copyFeedbackTimers.delete(button);
  }, 1500));
  return true;
}
