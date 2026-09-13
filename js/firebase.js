import { firebaseConfig } from './firebase-config.js';

const SDK_VERSION = '12.2.1';
const APP_URL = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`;
const DB_URL = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-database.js`;
let sdkPromise;

export function firebaseConfigured() {
  return Boolean(firebaseConfig.apiKey
    && firebaseConfig.databaseURL
    && !Object.values(firebaseConfig).some(value => String(value).includes('PASTE_')));
}

async function sdk() {
  if (!firebaseConfigured()) throw new Error('Firebase is not configured. Paste your web app values into js/firebase-config.js.');
  if (!sdkPromise) sdkPromise = Promise.all([import(APP_URL), import(DB_URL)]).then(([app, database]) => {
    const firebaseApp = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
    return { ...database, db: database.getDatabase(firebaseApp) };
  });
  return sdkPromise;
}

export async function readValue(path) {
  const { db, ref, get } = await sdk();
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function writeMany(values) {
  const { db, ref, update } = await sdk();
  await update(ref(db), values);
}

export async function appendProtectedEvent(kind, id, token, event) {
  const { db, ref, child, push, update, serverTimestamp } = await sdk();
  const root = `${kind}/${id}`;
  const eventRef = push(child(ref(db, root), 'events'));
  const eventId = eventRef.key;
  await update(ref(db, root), {
    proof: { eventId, token },
    [`events/${eventId}`]: { ...event, createdAt: serverTimestamp() },
  });
  return eventId;
}

export async function subscribeValue(path, listener, onError = console.error) {
  const { db, ref, onValue } = await sdk();
  return onValue(ref(db, path), snapshot => listener(snapshot.exists() ? snapshot.val() : null), onError);
}

export function connectionMessage(error) {
  const message = String(error?.message || error || 'Unknown Firebase error');
  if (/permission/i.test(message)) return 'Firebase denied this request. Check the database rules and the link token.';
  if (/network|offline|failed to fetch/i.test(message)) return 'Could not reach Firebase. Check your connection and database URL.';
  return message;
}
