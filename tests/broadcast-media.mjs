import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { playBroadcastTrailer } from '../js/broadcast-media.js';
import { WEB_TRAILERS, WEB_TRAILER_POSTERS } from '../js/trailer-assets.js';
import { getHeroTrailerUrls, getHeroTrailerPosterUrls } from '../js/heroes.js';

function fakeVideo(src = '') {
  return { src, currentTime:0, loads:0, plays:0, pauses:0,
    getAttribute() { return this.src; },
    load() { this.loads++; },
    pause() { this.pauses++; },
    play() { this.plays++; return Promise.resolve(); },
  };
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let done = 0, playing = 0;
const video = fakeVideo('warmed.mp4');
const cancel = playBroadcastTrailer(video, { sources:['warmed.mp4'], timeoutMs:150,
  onPlaying:() => playing++, onDone:() => done++ });
assert.equal(video.loads, 0, 'Do not reload a warmed video.');
assert.equal(video.plays, 1, 'Start playback immediately, without waiting for canplay.');
video.onplaying();
assert.equal(playing, 1);
// A healthy full trailer continues past the startup timeout while progressing.
for (let i = 0; i < 6; i++) { await pause(40); video.currentTime++; video.ontimeupdate(); }
assert.equal(done, 0);
video.onended();
assert.equal(done, 1);
assert.equal(video.onerror, null);
cancel();

const stalled = fakeVideo();
playBroadcastTrailer(stalled, { sources:['stall.mp4'], timeoutMs:35, onPlaying() {}, onDone:() => done++ });
await pause(65);
assert.equal(done, 2, 'A hung load must release the reveal queue.');
const fallback = fakeVideo();
playBroadcastTrailer(fallback, { sources:['bad.mp4','good.mp4'], onPlaying() {}, onDone:() => done++ });
fallback.onerror();
assert.equal(fallback.src, 'good.mp4');
fallback.onended();
assert.equal(done, 3);
const cancelled = fakeVideo();
const stop = playBroadcastTrailer(cancelled, { sources:['cancel.mp4'], timeoutMs:20, onPlaying() {}, onDone:() => done++ });
const stalePlaying = cancelled.onplaying;
stop(); stalePlaying(); await pause(35);
assert.equal(done, 3, 'Cancelled clips cannot mutate the next reveal.');
const rejected = fakeVideo();
rejected.play = () => Promise.reject(new Error('Autoplay blocked'));
playBroadcastTrailer(rejected, { sources:['blocked.mp4'], onPlaying() {}, onDone:() => done++ });
await pause(0);
assert.equal(done, 4);

let originalBytes = 0, webBytes = 0;
for (const [id, asset] of Object.entries(WEB_TRAILERS)) {
  const original = fs.readFileSync(new URL(`../assets/trailers/${id}.mp4`, import.meta.url));
  const web = fs.readFileSync(new URL(`../${asset.src}`, import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), asset.sourceHash, `${id}: rebuild web media after replacing the source.`);
  assert.equal(getHeroTrailerUrls(id)[0], asset.src);
  assert.equal(getHeroTrailerUrls(id, 'custom.mp4')[0], 'custom.mp4');
  let offset = 0, moov = -1, mdat = -1;
  while (offset + 8 <= web.length) {
    const size = web.readUInt32BE(offset), type = web.toString('ascii', offset+4, offset+8);
    assert.ok(size >= 8 && offset + size <= web.length);
    if (type === 'moov') moov = offset;
    if (type === 'mdat') mdat = offset;
    offset += size;
  }
  assert.ok(moov >= 0 && moov < mdat, `${id}: metadata must precede video data (faststart).`);
  assert.ok(web.includes(Buffer.from('avc1')), `${id}: web variant must be H.264.`);
  assert.equal(web.length, asset.bytes);
  originalBytes += original.length; webBytes += web.length;
}
assert.equal(Object.keys(WEB_TRAILERS).length, 41);
for (const [id, asset] of Object.entries(WEB_TRAILER_POSTERS)) {
  const original = fs.readFileSync(new URL(`../${asset.sourceSrc}`, import.meta.url));
  const web = fs.readFileSync(new URL(`../${asset.src}`, import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), asset.sourceHash, `${id}: rebuild after replacing artwork.`);
  assert.equal(getHeroTrailerPosterUrls(id)[0], asset.src);
  assert.equal(getHeroTrailerPosterUrls(id, 'custom.png')[0], 'custom.png');
  assert.equal(web.toString('ascii', 8, 12), 'WEBP');
  assert.equal(web.length, asset.bytes);
}
for (const id of ['0040', '0041']) assert.ok(WEB_TRAILER_POSTERS[id]);
assert.ok(webBytes < originalBytes * 0.6);
console.log(`Broadcast playback, stall recovery, cancellation and 41 versioned H.264 assets passed (${Math.round((1-webBytes/originalBytes)*100)}% smaller).`);
