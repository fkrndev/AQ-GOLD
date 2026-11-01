(() => {
  const BTN_TEXT = /browse job directory/i;
  const OUR_ID = 'aq-download-logs-btn';
  const API = 'https://experts.afterquery.com/api/gold-trpc';

  function findBrowseBtn() {
    return [...document.querySelectorAll('button')]
      .find(b => BTN_TEXT.test(b.innerText || ''));
  }

  function inject() {
    const btn = findBrowseBtn();
    if (!btn || document.getElementById(OUR_ID)) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:6px;';
    btn.parentElement.insertBefore(wrap, btn);
    wrap.appendChild(btn);

    const dl = btn.cloneNode(true);
    dl.id = OUR_ID;
    dl.textContent = 'Download all files';
    dl.removeAttribute('disabled');
    dl.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      downloadAll(dl);
    });
    wrap.appendChild(dl);
  }

  async function getToken() {
    const recs = await new Promise((res, rej) => {
      const rq = indexedDB.open('firebaseLocalStorageDb');
      rq.onsuccess = () => {
        const g = rq.result.transaction('firebaseLocalStorage', 'readonly')
          .objectStore('firebaseLocalStorage').getAll();
        g.onsuccess = () => res(g.result);
        g.onerror = () => rej(g.error);
      };
      rq.onerror = () => rej(rq.error);
    });
    const rec = recs.find(r => r.value?.stsTokenManager?.accessToken);
    if (!rec) throw new Error('Firebase token not found in IndexedDB');
    const m = rec.value.stsTokenManager;
    if (Date.now() < m.expirationTime - 60000) return m.accessToken;

    const apiKey = (rec.fbase_key.match(/authUser:([^:]+):/) || [])[1];
    if (!apiKey || !m.refreshToken) throw new Error('Cannot refresh Firebase token');
    const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(m.refreshToken)}`,
    }).then(r => r.json());
    if (!resp.id_token) throw new Error('Firebase token refresh failed');
    return resp.id_token;
  }

  async function trpc(proc, input, token) {
    const url = `${API}/${proc}?batch=1&input=` +
      encodeURIComponent(JSON.stringify({ "0": { json: input } }));
    const j = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.json());
    const entry = j?.[0];
    if (entry?.error) throw new Error(entry.error.json?.message || 'tRPC error');
    return entry?.result?.data?.json;
  }

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();

  function crc32(data) {
    let c = ~0;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return ~c >>> 0;
  }

  function buildZip(entries) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of entries) {
      const nameB = enc.encode(name);
      const crc = crc32(data);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(lh.buffer), nameB, data);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, nameB.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);

      offset += 30 + nameB.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, entries.length, true);
    eocd.setUint16(10, entries.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)], { type: 'application/zip' });
  }

  async function downloadAll(btn) {
    const reset = (msg) => {
      btn.disabled = false;
      btn.textContent = msg || 'Download all files';
    };
    try {
      btn.disabled = true;
      const subId = location.pathname.split('/tasks/')[1]?.split(/[/?#]/)[0];
      if (!subId) throw new Error('No submission id in URL');

      btn.textContent = 'Authenticating…';
      const token = await getToken();

      btn.textContent = 'Listing runs…';
      const runs = await trpc('gold.tasks.runs.list',
        { submissionId: subId, viewAsExpert: false }, token);
      const runList = Array.isArray(runs) ? runs : [];
      if (!runList.length) throw new Error('No runs found for this task');

      const files = [];
      let done = 0;
      const jobs = [];
      for (let i = 0; i < runList.length; i++) {
        const run = runList[i];
        const rid = run.id ?? run.runId;
        if (!rid) continue;
        const f = await trpc('gold.tasks.runs.files', { runId: rid }, token);
        const paths = (f?.files ?? []).map(x => x.path);
        const prefix = runList.length > 1 ? `attempt-${i + 1}/` : '';
        for (const p of paths) jobs.push({ rid, path: p, name: prefix + p });
      }

      const CONCURRENCY = 8;
      for (let i = 0; i < jobs.length; i += CONCURRENCY) {
        btn.textContent = `Downloading ${done}/${jobs.length}…`;
        const batch = await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async j => {
          const rf = await trpc('gold.tasks.runs.readFile', { runId: j.rid, path: j.path }, token);
          return { name: j.name, data: new TextEncoder().encode(rf?.content ?? '') };
        }));
        files.push(...batch);
        done += batch.length;
      }

      if (!files.length) {
        btn.textContent = 'No files found';
        setTimeout(() => reset(), 3000);
        return;
      }

      btn.textContent = 'Zipping…';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(buildZip(files));
      a.download = `${subId}-files.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      btn.textContent = `Done (${files.length} files)`;
      setTimeout(() => reset(), 5000);
    } catch (e) {
      btn.textContent = `Failed: ${e.message || e}`;
      setTimeout(() => reset(), 6000);
    }
  }

  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
  inject();
})();
