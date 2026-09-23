// A stalled/missing clip must not block every later pick in the reveal queue.
export function playBroadcastTrailer(video, { sources, onPlaying, onDone, timeoutMs = 8000 }) {
  let done = false, index = 0, attempt = 0, timer = null, lastTime = -1;
  const cleanup = () => {
    clearTimeout(timer);
    video.onplaying = video.ontimeupdate = video.onwaiting = video.onstalled = null;
    video.oncanplay = video.onended = video.onerror = null;
  };
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    video.pause();
    onDone();
  };
  const watchProgress = () => { clearTimeout(timer); timer = setTimeout(finish, timeoutMs); };
  const next = () => {
    if (done) return;
    const source = sources[index++], currentAttempt = ++attempt;
    if (!source) { finish(); return; }
    // Reuse a preloaded element instead of throwing away its buffered media.
    if (video.getAttribute('src') !== source) {
      video.src = source;
      video.load();
    }
    try {
      Promise.resolve(video.play()).catch(error => {
        if (done || currentAttempt !== attempt) return;
        if (error?.name === 'NotSupportedError') next();
        else finish();
      });
    } catch { finish(); }
  };
  video.muted = true;
  video.playsInline = true;
  video.loop = false;
  video.onplaying = () => {
    if (done) return;
    watchProgress();
    onPlaying();
  };
  video.ontimeupdate = () => {
    if (!done && video.currentTime !== lastTime) { lastTime = video.currentTime; watchProgress(); }
  };
  video.onwaiting = video.onstalled = () => { if (!done && !timer) watchProgress(); };
  video.onended = finish;
  video.onerror = next;
  watchProgress();
  next();
  return () => { done = true; cleanup(); };
}
