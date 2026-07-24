/* ------------------------------------------------------------------
   เว็บฟังนิยายเสียง — ฝั่งหน้าจอ

   หลักการ: เซิร์ฟเวอร์ตัดเนื้อเรื่องเป็นก้อนสั้น ๆ มาให้แล้ว
   ฝั่งนี้แค่ไล่ขอไฟล์เสียงทีละก้อน เล่นต่อกัน และโหลดก้อนถัดไปดักไว้ล่วงหน้า
   ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const el = {
  form: $('load-form'), url: $('url'), loadBtn: $('load-btn'),
  settingsToggle: $('settings-toggle'), settings: $('settings'),
  engine: $('engine'), voice: $('voice'),
  speed: $('speed'), speedVal: $('speed-val'), sleep: $('sleep'),
  cacheInfo: $('cache-info'),
  status: $('status'), title: $('title'), meta: $('meta'), reader: $('reader'),
  player: $('player'), fill: $('progress-fill'),
  prev: $('prev'), play: $('play'), next: $('next'),
  pos: $('pos'), total: $('total'), goNext: $('go-next-chapter'),
};

const PREFETCH = 2;          // โหลดดักไว้กี่ก้อนข้างหน้า
const state = {
  config: {},
  chunks: [],
  idx: 0,
  playing: false,
  url: '',
  nextUrl: null,
  audio: new Audio(),
  blobs: new Map(),          // index -> objectURL
  pending: new Map(),        // index -> Promise
  sleepTimer: null,
};

/* ------------------------------------------------------------------ ตั้งค่า */

async function boot() {
  try {
    state.config = await (await fetch('/api/config')).json();
  } catch {
    state.config = {};
  }

  el.engine.innerHTML =
    '<option value="edge">Microsoft Neural (ฟรี)</option>' +
    '<option value="gemini">Google Gemini (ต้องมีคีย์)</option>';
  el.engine.value = state.config.engine || 'edge';

  await loadVoices();
  refreshCacheInfo();

  const last = localStorage.getItem('lastUrl');
  if (last) el.url.value = last;
}

async function loadVoices() {
  el.voice.innerHTML = '<option>กำลังโหลด...</option>';
  try {
    const data = await (await fetch(`/api/voices?engine=${el.engine.value}`)).json();
    if (data.detail) throw new Error(data.detail);

    el.voice.innerHTML = '';
    for (const v of data.voices) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.locale.startsWith('th') ? `⭐ ${v.name}` : v.name;
      el.voice.appendChild(opt);
    }
    const saved = localStorage.getItem(`voice:${el.engine.value}`);
    el.voice.value = saved || state.config.voice || data.voices[0]?.id || '';
  } catch (err) {
    el.voice.innerHTML = `<option>ใช้ไม่ได้: ${err.message}</option>`;
  }
}

async function refreshCacheInfo() {
  try {
    const d = await (await fetch('/api/cache-size')).json();
    el.cacheInfo.textContent = `เสียงที่เก็บไว้แล้ว ${d.files} ไฟล์ (${d.mb} MB) — ฟังซ้ำไม่ต้องโหลดใหม่`;
  } catch { /* ไม่สำคัญพอที่จะแจ้งผู้ใช้ */ }
}

/* ------------------------------------------------------------------ ดึงเนื้อหา */

async function loadUrl(url) {
  stop();
  setStatus('กำลังดึงเนื้อหา...');
  el.loadBtn.disabled = true;
  clearBlobs();

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'ดึงเนื้อหาไม่สำเร็จ');

    state.chunks = data.chunks;
    state.url = data.url;
    state.nextUrl = data.next_url;
    localStorage.setItem('lastUrl', data.url);

    render(data);
    const saved = Number(localStorage.getItem(`pos:${data.url}`) || 0);
    setIndex(Math.min(saved, data.chunks.length - 1));
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    el.loadBtn.disabled = false;
  }
}

function render(data) {
  el.status.classList.add('hidden');
  el.title.textContent = data.title;
  el.title.classList.remove('hidden');

  const how = data.method === 'sites.json' ? 'ใช้กฎเฉพาะเว็บ' : 'แกะอัตโนมัติ';
  el.meta.textContent = `${data.chunks.length} ย่อหน้า · ${data.char_count.toLocaleString()} ตัวอักษร · ${how}`;
  el.meta.classList.remove('hidden');

  el.reader.innerHTML = '';
  data.chunks.forEach((text, i) => {
    const p = document.createElement('p');
    p.textContent = text;
    p.dataset.i = i;
    p.onclick = () => { setIndex(i); play(); };
    el.reader.appendChild(p);
  });

  el.total.textContent = data.chunks.length;
  el.player.classList.remove('hidden');
  el.goNext.classList.toggle('hidden', !data.next_url);
}

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.classList.remove('hidden');
  el.status.classList.toggle('error', isError);
}

/* ------------------------------------------------------------------ เสียง */

function clearBlobs() {
  for (const url of state.blobs.values()) URL.revokeObjectURL(url);
  state.blobs.clear();
  state.pending.clear();
}

function fetchAudio(i) {
  if (i < 0 || i >= state.chunks.length) return Promise.resolve(null);
  if (state.blobs.has(i)) return Promise.resolve(state.blobs.get(i));
  if (state.pending.has(i)) return state.pending.get(i);

  const job = (async () => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: state.chunks[i],
        engine: el.engine.value,
        voice: el.voice.value,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'สร้างเสียงไม่สำเร็จ');
    }
    const url = URL.createObjectURL(await res.blob());
    state.blobs.set(i, url);
    state.pending.delete(i);
    return url;
  })();

  state.pending.set(i, job);
  return job;
}

function prefetch(from) {
  for (let i = from + 1; i <= from + PREFETCH; i++) fetchAudio(i).catch(() => {});
}

async function play() {
  if (state.idx >= state.chunks.length) return;

  state.playing = true;
  el.play.textContent = '⏸';
  el.play.classList.add('loading');

  try {
    const src = await fetchAudio(state.idx);
    if (!state.playing) return;           // ผู้ใช้กดหยุดระหว่างรอโหลด

    state.audio.src = src;
    state.audio.playbackRate = Number(el.speed.value);
    await state.audio.play();
    el.play.classList.remove('loading');
    prefetch(state.idx);
    updateMediaSession();
  } catch (err) {
    el.play.classList.remove('loading');
    if (err.name !== 'AbortError') {
      state.playing = false;
      el.play.textContent = '▶';
      setStatus(err.message, true);
    }
  }
}

function pause() {
  state.playing = false;
  state.audio.pause();
  el.play.textContent = '▶';
  el.play.classList.remove('loading');
}

function stop() {
  pause();
  state.audio.removeAttribute('src');
}

function setIndex(i) {
  state.idx = Math.max(0, Math.min(i, state.chunks.length - 1));

  el.reader.querySelectorAll('p').forEach((p, n) => {
    p.classList.toggle('current', n === state.idx);
    p.classList.toggle('done', n < state.idx);
  });

  const current = el.reader.querySelector('p.current');
  if (current) current.scrollIntoView({ block: 'center', behavior: 'smooth' });

  el.pos.textContent = state.idx + 1;
  el.fill.style.width = `${((state.idx + 1) / state.chunks.length) * 100}%`;
  if (state.url) localStorage.setItem(`pos:${state.url}`, state.idx);
}

state.audio.addEventListener('ended', () => {
  if (!state.playing) return;
  if (state.idx + 1 < state.chunks.length) {
    setIndex(state.idx + 1);
    play();
  } else {
    pause();
    refreshCacheInfo();
    if (state.nextUrl) setStatus('จบตอนแล้ว — กดปุ่ม "ตอนถัดไป" เพื่อไปต่อ');
  }
});

/* ------------------------------------------------------------------ ปุ่มบนหูฟัง/หน้าจอล็อก */

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: el.title.textContent || 'นิยาย',
    artist: `ย่อหน้า ${state.idx + 1} / ${state.chunks.length}`,
  });
  navigator.mediaSession.setActionHandler('play', play);
  navigator.mediaSession.setActionHandler('pause', pause);
  navigator.mediaSession.setActionHandler('previoustrack', () => { setIndex(state.idx - 1); play(); });
  navigator.mediaSession.setActionHandler('nexttrack', () => { setIndex(state.idx + 1); play(); });
}

/* ------------------------------------------------------------------ เหตุการณ์ */

el.form.onsubmit = (e) => { e.preventDefault(); if (el.url.value.trim()) loadUrl(el.url.value.trim()); };

el.settingsToggle.onclick = () => el.settings.classList.toggle('hidden');

el.play.onclick = () => (state.playing ? pause() : play());
el.prev.onclick = () => { setIndex(state.idx - 1); if (state.playing) play(); };
el.next.onclick = () => { setIndex(state.idx + 1); if (state.playing) play(); };

el.goNext.onclick = () => { if (state.nextUrl) { el.url.value = state.nextUrl; loadUrl(state.nextUrl); } };

el.speed.oninput = () => {
  el.speedVal.textContent = `${Number(el.speed.value).toFixed(2)}x`;
  state.audio.playbackRate = Number(el.speed.value);
  localStorage.setItem('speed', el.speed.value);
};

el.engine.onchange = async () => { clearBlobs(); await loadVoices(); };
el.voice.onchange = () => {
  clearBlobs();
  localStorage.setItem(`voice:${el.engine.value}`, el.voice.value);
};

el.sleep.onchange = () => {
  clearTimeout(state.sleepTimer);
  const mins = Number(el.sleep.value);
  if (mins > 0) state.sleepTimer = setTimeout(pause, mins * 60000);
};

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
  if (e.code === 'ArrowLeft') el.prev.click();
  if (e.code === 'ArrowRight') el.next.click();
});

/* ------------------------------------------------------------------ เริ่ม */

const savedSpeed = localStorage.getItem('speed');
if (savedSpeed) {
  el.speed.value = savedSpeed;
  el.speedVal.textContent = `${Number(savedSpeed).toFixed(2)}x`;
}

boot();
