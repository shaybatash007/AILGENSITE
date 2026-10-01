// AILGEN Lab · AI UNIFIED: the composer in the page. Images and video clips in order, a voice-over and a music bed, drawn on a
// canvas and recorded into one video file (MP4 where the browser records it, otherwise WebM). It renders in real time, so a 12-
// second film takes about 12 seconds, and the tab should stay open meanwhile. The agent's CLI composes the same node with ffmpeg.
//   compose({ visuals, voice, music }, { aspect, imageSeconds, maxVideoSeconds, musicVolume, fade, keepVideoAudio, fps }, onProgress, fetchBlob)
const SIZE = { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [1080, 1080], '4:5': [864, 1080] };
const MIME = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export async function compose({ visuals = [], voice, music }, d = {}, onProgress = () => {}, fetchBlob) {
  if (!visuals.length) throw new Error('אין תמונות או סרטונים להרכבה');
  if (typeof MediaRecorder === 'undefined') throw new Error('הדפדפן הזה לא מקליט וידאו');
  const [W, H] = SIZE[d.aspect] || SIZE['9:16'], fps = d.fps || 30, fade = d.fade ?? 0.35;
  onProgress({ progress: 'טוען קבצים' });
  const url = async v => URL.createObjectURL(await fetchBlob(v));
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume().catch(() => {});
  const decode = async v => v ? ctx.decodeAudioData(await (await fetchBlob(v.value)).arrayBuffer()) : null;

  // the visuals, loaded: an image becomes a bitmap, a clip a muted <video> ready at frame 0
  const segs = [];
  for (const it of visuals) {
    if (it.kind === 'video') {
      const v = document.createElement('video'); v.muted = !d.keepVideoAudio; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = await url(it.value);
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('סרטון לא נטען')); });
      segs.push({ kind: 'video', el: v, dur: Math.min(v.duration || 4, d.maxVideoSeconds || 60) });
    } else segs.push({ kind: 'image', el: await createImageBitmap(await fetchBlob(it.value)), dur: +d.imageSeconds || 3 });
  }
  const [vo, mu] = await Promise.all([decode(voice), decode(music)]);
  // the length: the visuals, stretched (images) or held (the last clip's frame) to cover the voice-over
  let total = segs.reduce((a, s) => a + s.dur, 0);
  if (vo && vo.duration + 0.6 > total) {
    const imgs = segs.filter(s => s.kind === 'image');
    if (imgs.length) { const extra = (vo.duration + 0.6 - total) / imgs.length; imgs.forEach(s => { s.dur += extra; }); }
    else segs[segs.length - 1].hold = vo.duration + 0.6 - total;
    total = vo.duration + 0.6;
  }
  let t = 0; for (const s of segs) { s.at = t; t += s.dur + (s.hold || 0); }

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const cover = (el, k = 1) => { const w = el.videoWidth || el.width, h = el.videoHeight || el.height, sc = Math.max(W / w, H / h) * k; g.drawImage(el, (W - w * sc) / 2, (H - h * sc) / 2, w * sc, h * sc); };
  const dest = ctx.createMediaStreamDestination();
  const stream = new MediaStream([...cv.captureStream(fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = MIME.find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 6e6, audioBitsPerSecond: 160e3 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(ok => { rec.onstop = ok; });

  // audio: the voice at full level, the music under it (lower while the voice speaks), a fade-out at the end
  const t0 = ctx.currentTime + 0.25;
  if (vo) { const s = ctx.createBufferSource(); s.buffer = vo; s.connect(dest); s.start(t0 + 0.3); }
  if (mu) {
    const s = ctx.createBufferSource(), gain = ctx.createGain(), lvl = d.musicVolume ?? (vo ? 0.22 : 0.8);
    s.buffer = mu; s.loop = mu.duration < total; gain.gain.setValueAtTime(lvl, t0); gain.gain.setValueAtTime(lvl, t0 + Math.max(0, total - 1.2)); gain.gain.linearRampToValueAtTime(0.0001, t0 + total);
    s.connect(gain).connect(dest); s.start(t0); s.stop(t0 + total + 0.1);
  }
  if (d.keepVideoAudio) for (const s of segs) if (s.kind === 'video') ctx.createMediaElementSource(s.el).connect(dest);

  rec.start(250);
  await new Promise(ok => {
    let cur = -1;
    const frame = () => {
      const now = ctx.currentTime - t0;
      if (now >= total) return ok();
      const i = Math.max(0, segs.findLastIndex(s => s.at <= now)), s = segs[i], local = now - s.at;
      if (i !== cur) { cur = i; segs.forEach((x, j) => { if (x.kind === 'video') { if (j === i) { x.el.currentTime = 0; x.el.play().catch(() => {}); } else x.el.pause(); } }); }
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const draw = (x, l) => x.kind === 'image' ? cover(x.el, 1 + 0.06 * Math.min(1, l / Math.max(1, x.dur))) : cover(x.el);
      if (i > 0 && local < fade) { draw(segs[i - 1], segs[i - 1].dur); g.globalAlpha = local / fade; draw(s, local); g.globalAlpha = 1; } else draw(s, local);
      if (now > total - 0.5) { g.fillStyle = `rgba(0,0,0,${(now - (total - 0.5)) / 0.5})`; g.fillRect(0, 0, W, H); }
      onProgress({ progress: `${Math.round(now / total * 100)}%` });
      setTimeout(frame, 1000 / fps);   // a timer, not requestAnimationFrame: it keeps drawing when the canvas is not on screen
    };
    frame();
  });
  rec.stop(); await stopped; segs.forEach(s => s.kind === 'video' && s.el.pause()); ctx.close().catch(() => {});
  const type = (mime || 'video/webm').split(';')[0], blob = new Blob(chunks, { type });
  return { kind: 'video', value: URL.createObjectURL(blob), local: true, mime: type, seconds: +total.toFixed(1), size: blob.size, name: `ailgen-unified-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}` };
}
