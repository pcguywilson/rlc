(() => {
  'use strict';

  const THREAD_RE = /\/comments\/([a-z0-9]+)/i;
  const SUB_RE = /^\/r\/([^/]+)/i;
  const MAX_CARDS = 1500;
  const THREAD_EVERY = 6; // when the sub feed works, full thread re-scan every N polls

  const THEMES = {
    stream: { label: 'Teal', bg: '#002b36', bar: '#00212b', card: '#073642', text: '#e4ecef', muted: '#8fa3a8', accent: '#2f9be8', border: '#0d4250', flairBg: 'transparent', flair: '#8fa3a8', fresh: '#11543f', up: '#ff8b60', down: '#9494ff' },
    dark:   { label: 'Dark', bg: '#0f1115', bar: '#161a21', card: '#1a1f28', text: '#e8eaee', muted: '#8a93a3', accent: '#6cb6ff', border: '#262c38', flairBg: '#262c38', flair: '#c3c9d4', fresh: '#24361d', up: '#ff8b60', down: '#9494ff' },
    oled:   { label: 'Black', bg: '#000000', bar: '#0a0a0a', card: '#111111', text: '#f2f2f2', muted: '#8c8c8c', accent: '#4ea1ff', border: '#1f1f1f', flairBg: '#1f1f1f', flair: '#bdbdbd', fresh: '#1e3317', up: '#ff8b60', down: '#9494ff' },
    light:  { label: 'Light', bg: '#e9ebee', bar: '#ffffff', card: '#ffffff', text: '#111317', muted: '#4b525e', accent: '#0a58b0', border: '#d3d7dd', flairBg: '#e9ebee', flair: '#3a404a', fresh: '#d4f0c8', up: '#d9480f', down: '#4c4cc9' },
  };
  const SIZES = { S: 15, M: 17, L: 19, XL: 22 };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const snip = (s, n = 120) => { s = String(s ?? '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n) + '...' : s; };
  const ago = (t) => { const s = Math.max(0, Math.floor(Date.now() / 1000 - t)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`; };
  const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    return r.json();
  }

  function makeFab(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#2f9be8;color:#fff;border:0;border-radius:20px;padding:10px 16px;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4)';
    b.addEventListener('click', onClick);
    document.documentElement.appendChild(b);
    return b;
  }

  // New Reddit: hand off to old.reddit.com, which is static and easy to take over.
  if (location.hostname !== 'old.reddit.com') {
    const fab = makeFab('', () => {
      const t = location.pathname.match(THREAD_RE);
      const s = location.pathname.match(SUB_RE);
      if (t) location.href = `https://old.reddit.com/comments/${t[1]}/#stream`;
      else if (s) location.href = `https://old.reddit.com/r/${s[1]}/#live`;
    });
    const sync = () => {
      const t = THREAD_RE.test(location.pathname);
      const s = SUB_RE.test(location.pathname);
      fab.style.display = t || s ? '' : 'none';
      fab.textContent = t ? '⚡ Stream' : '⚡ Live thread';
    };
    sync();
    setInterval(sync, 1000); // new Reddit is an SPA, URL changes without reloads
    return;
  }

  // Old Reddit
  const thread = location.pathname.match(THREAD_RE);
  if (thread) {
    if (location.hash === '#stream') startStream(thread[1]);
    else makeFab('⚡ Stream', () => { history.replaceState(null, '', '#stream'); startStream(thread[1]); });
    return;
  }
  const subMatch = location.pathname.match(SUB_RE);
  if (subMatch) {
    const go = () => findLive(subMatch[1]);
    if (location.hash === '#live') go();
    else makeFab('⚡ Live thread', go);
  }

  async function findLive(subName) {
    try {
      const j = await getJSON(`/r/${subName}/hot.json?limit=15&raw_json=1`);
      const posts = j.data.children.map((c) => c.data);
      const pick =
        posts.find((p) => p.stickied && /live|discussion/i.test(p.title)) ||
        posts.find((p) => /live discussion|live thread|fight thread/i.test(p.title)) ||
        posts.find((p) => p.stickied);
      if (!pick) return alert(`No live or stickied thread found in r/${subName}`);
      location.href = `/comments/${pick.id}/#stream`;
    } catch (e) {
      alert(`Live thread lookup failed: ${e.message}`);
    }
  }

  function startStream(id) {
    if (window.__rlcActive) return;
    window.__rlcActive = true;

    // Grab the modhash (CSRF token for votes/replies) before the page is wiped.
    let modhash = document.querySelector('input[name="uh"]')?.value || null;

    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());
    document.documentElement.className = ''; // drop RES night mode etc.
    const css = document.createElement('style');
    css.textContent = `
      html,body{background:var(--bg)!important;color:var(--text);margin:0;font-family:system-ui,"Segoe UI",Roboto,sans-serif;font-size:var(--fs)}
      #rlc-bar{position:sticky;top:0;z-index:10;background:var(--bar);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;gap:8px 16px;align-items:center}
      #rlc-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #rlc-title a{color:var(--text);font-weight:700;font-size:16px;text-decoration:none}
      #rlc-ctrl{display:flex;gap:8px;align-items:center;flex-shrink:0}
      #rlc-ctrl input,#rlc-ctrl select,#rlc-ctrl button,.rlc-reply button{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;font:inherit;font-size:13px}
      #rlc-filter{width:130px}
      #rlc-ctrl button,.rlc-reply button{cursor:pointer}
      #rlc-status{color:var(--muted);font-size:13px;white-space:nowrap}
      #rlc-list{max-width:1200px;margin:0 auto;padding:12px 20px 20px}
      .rlc-c{padding:7px 0}
      .rlc-meta{font-size:calc(var(--fs) * .82);color:var(--muted);display:flex;gap:10px;align-items:center;padding:0 2px 4px}
      .rlc-author{color:var(--muted);font-weight:700;text-decoration:none}
      .rlc-author:hover{color:var(--accent)}
      .rlc-flair{background:var(--flairBg);color:var(--flair);border-radius:4px;padding:0 6px;font-size:.9em}
      .rlc-acts{margin-left:auto;display:flex;gap:12px;align-items:center}
      .rlc-acts a,.rlc-acts button{color:var(--accent);text-decoration:none;font-weight:600;background:none;border:0;padding:0;cursor:pointer;font:inherit;font-weight:600}
      .rlc-vote{color:var(--muted)!important;font-size:1.15em!important;line-height:1}
      .rlc-c[data-likes="1"] .rlc-vote[data-act="up"]{color:var(--up)!important}
      .rlc-c[data-likes="-1"] .rlc-vote[data-act="down"]{color:var(--down)!important}
      .rlc-c[data-likes="1"] .rlc-score{color:var(--up)}
      .rlc-c[data-likes="-1"] .rlc-score{color:var(--down)}
      .rlc-score{min-width:1.5em;text-align:center}
      .rlc-box{background:var(--card);border-radius:4px;padding:9px 14px;line-height:1.5;overflow-wrap:anywhere}
      .rlc-fresh .rlc-box{animation:rlcfade 3s ease-out}
      @keyframes rlcfade{from{background:var(--fresh)}to{background:var(--card)}}
      .rlc-ctx{font-size:calc(var(--fs) * .8);color:var(--muted);border-left:3px solid var(--accent);padding:1px 0 1px 8px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
      .rlc-ctx b{font-weight:700}
      /* RES and old Reddit inject styles after us; pin our colors */
      .rlc-box,.rlc-body,.rlc-body *{color:var(--text)!important}
      .rlc-box{background:var(--card)!important}
      .rlc-ctx,.rlc-ctx *{color:var(--muted)!important}
      .rlc-author{color:var(--muted)!important}
      .rlc-author:hover,.rlc-body a,.rlc-acts a,.rlc-acts button:not(.rlc-vote){color:var(--accent)!important}
      .rlc-body p{margin:0 0 4px}
      .rlc-body p:last-child{margin-bottom:0}
      .rlc-body a{color:var(--accent)}
      .rlc-body blockquote{border-left:3px solid var(--border);margin:4px 0;padding-left:10px;color:var(--muted)}
      .rlc-body img{max-width:100%}
      .rlc-reply{margin-top:6px;display:flex;flex-direction:column;gap:6px}
      .rlc-reply textarea{width:100%;box-sizing:border-box;min-height:70px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font:inherit;font-size:var(--fs);resize:vertical}
      .rlc-reply div{display:flex;gap:8px;align-items:center}
      .rlc-reply .rlc-err{color:var(--up);font-size:13px}
      #rlc-foot{max-width:1200px;margin:0 auto;padding:0 20px 90px}
      @media (max-width:700px){
        #rlc-bar{flex-wrap:wrap;padding:8px 10px;gap:6px}
        #rlc-title{flex-basis:100%}
        #rlc-title a{font-size:14px}
        #rlc-ctrl{flex-wrap:wrap;gap:6px;width:100%}
        #rlc-filter{display:none}
        #rlc-status{flex-basis:100%;order:9;font-size:12px}
        #rlc-list{padding:6px 8px 12px}
        #rlc-foot{padding:0 8px 90px}
        .rlc-box{padding:8px 10px}
        .rlc-meta{flex-wrap:wrap;gap:4px 8px}
        .rlc-acts{gap:14px}
        .rlc-vote{font-size:1.5em!important;padding:2px 6px!important}
      }
      #rlc-new{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;border-radius:18px;padding:6px 16px;cursor:pointer;z-index:11;font-size:14px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.35)}
    `;
    document.head.appendChild(css);
    document.querySelectorAll('meta[name="viewport"]').forEach((el) => el.remove());
    const vp = document.createElement('meta');
    vp.name = 'viewport';
    vp.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(vp);

    document.body.className = '';
    document.body.innerHTML = `
      <div id="rlc-bar">
        <div id="rlc-title">Loading...</div>
        <div id="rlc-ctrl">
          <span id="rlc-status"></span>
          <input id="rlc-filter" placeholder="filter">
          <select id="rlc-theme" title="Theme">${Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>
          <select id="rlc-size" title="Text size">${Object.keys(SIZES).map((k) => `<option value="${k}">${k}</option>`).join('')}</select>
          <select id="rlc-int" title="Refresh">
            <option value="3">3s</option><option value="5">5s</option><option value="8">8s</option><option value="15">15s</option>
          </select>
          <button id="rlc-pause">Pause</button>
          <button id="rlc-exit">Exit</button>
        </div>
      </div>
      <div id="rlc-list"></div>
      <div id="rlc-foot"><div class="rlc-acts" style="justify-content:flex-start"><button data-act="reply-post">reply to post</button></div></div>
      <div id="rlc-new" hidden></div>`;

    const $ = (s) => document.getElementById(s);
    const listEl = $('rlc-list'), statusEl = $('rlc-status'), newPill = $('rlc-new'), filterEl = $('rlc-filter');
    const themeEl = $('rlc-theme'), sizeEl = $('rlc-size'), intEl = $('rlc-int'), pauseBtn = $('rlc-pause'), footEl = $('rlc-foot');
    const root = document.documentElement;

    function applyTheme(k) {
      const t = THEMES[k] || THEMES.stream;
      for (const [prop, val] of Object.entries(t)) if (prop !== 'label') root.style.setProperty(`--${prop}`, val);
      themeEl.value = THEMES[k] ? k : 'stream';
    }
    function applySize(k) {
      root.style.setProperty('--fs', `${SIZES[k] || SIZES.M}px`);
      sizeEl.value = SIZES[k] ? k : 'M';
    }
    applyTheme(load('rlcTheme', 'stream'));
    applySize(load('rlcSize', 'M'));

    const seen = new Map();
    const moreQueue = new Set();
    let interval = +load('rlcInterval', 5) || 5;
    intEl.value = String(interval);
    let paused = false, timer = null, backoff = 0, pendingNew = 0, first = true, sub = null, tick = 0;
    let subFeed = true; // flips off for good if Reddit refuses the sub-wide feed

    const setStatus = (t) => { statusEl.textContent = t; };
    const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 150;
    const toBottom = (smooth) => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

    // ---------- voting / replying ----------
    async function getModhash() {
      if (modhash) return modhash;
      const j = await getJSON('/api/me.json');
      modhash = j?.data?.modhash || null;
      if (!modhash) throw new Error('not logged in');
      return modhash;
    }

    async function postForm(path, params) {
      const uh = await getModhash();
      const body = new URLSearchParams({ ...params, uh, api_type: 'json' });
      const r = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Modhash': uh },
        body,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json().catch(() => ({}));
      const errs = j?.json?.errors;
      if (errs && errs.length) throw new Error(errs.map((e) => e[1] || e[0]).join('; '));
      return j;
    }

    async function vote(el, dir) {
      const cur = +el.dataset.likes || 0;
      const next = cur === dir ? 0 : dir; // clicking the active arrow clears the vote
      const scoreEl = el.querySelector('.rlc-score');
      const base = +scoreEl.dataset.base;
      el.dataset.likes = String(next);
      if (!scoreEl.dataset.hidden) scoreEl.textContent = String(base + next);
      try {
        await postForm('/api/vote', { id: `t1_${el.dataset.id}`, dir: String(next), rank: '2' });
      } catch (e) {
        el.dataset.likes = String(cur);
        if (!scoreEl.dataset.hidden) scoreEl.textContent = String(base + cur);
        setStatus(`vote failed: ${e.message}`);
      }
    }

    function openReply(anchor, thingId) {
      const existing = anchor.querySelector(':scope > .rlc-reply');
      if (existing) { existing.querySelector('textarea').focus(); return; }
      const box = document.createElement('div');
      box.className = 'rlc-reply';
      box.innerHTML = `<textarea placeholder="Reply..."></textarea><div><button data-r="send">Send</button><button data-r="cancel">Cancel</button><span class="rlc-err"></span></div>`;
      anchor.appendChild(box);
      const ta = box.querySelector('textarea'), errEl = box.querySelector('.rlc-err'), sendBtn = box.querySelector('[data-r="send"]');
      ta.focus();
      const send = async () => {
        const text = ta.value.trim();
        if (!text) return;
        sendBtn.disabled = true; errEl.textContent = '';
        try {
          const j = await postForm('/api/comment?raw_json=1', { thing_id: thingId, text });
          const d = j?.json?.data?.things?.[0]?.data;
          box.remove();
          if (d && d.id && !seen.has(d.id)) {
            const c = {
              id: d.id, author: d.author || 'you', body: d.body ?? text, body_html: null,
              parent_id: d.parent || thingId, link_id: `t3_${id}`, author_flair_text: d.author_flair_text,
              permalink: d.permalink || '', created_utc: d.created_utc || Date.now() / 1000, score: 1, likes: true,
            };
            seen.set(c.id, c);
            const stick = nearBottom();
            insert(card(c, true), c.created_utc);
            if (stick) toBottom(true);
          }
        } catch (e) {
          errEl.textContent = e.message;
          sendBtn.disabled = false;
        }
      };
      sendBtn.addEventListener('click', send);
      box.querySelector('[data-r="cancel"]').addEventListener('click', () => box.remove());
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
        if (e.key === 'Escape') box.remove();
      });
    }

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const el = btn.closest('.rlc-c');
      if (!el) return;
      e.preventDefault();
      const act = btn.dataset.act;
      if (act === 'up') vote(el, 1);
      else if (act === 'down') vote(el, -1);
      else if (act === 'reply') openReply(el, `t1_${el.dataset.id}`);
    });
    footEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="reply-post"]')) openReply(footEl, `t3_${id}`);
    });

    // ---------- rendering ----------
    function applyFilter(el) {
      const q = filterEl.value.trim().toLowerCase();
      el.hidden = q !== '' && !el.dataset.text.includes(q);
    }

    function card(c, isNew) {
      const el = document.createElement('div');
      el.className = 'rlc-c' + (isNew ? ' rlc-fresh' : '');
      el.dataset.id = c.id;
      el.dataset.t = String(c.created_utc);
      el.dataset.text = `${c.author} ${c.body}`.toLowerCase();
      const likes = c.likes === true ? 1 : c.likes === false ? -1 : 0;
      el.dataset.likes = String(likes);
      const base = (c.score ?? 1) - likes;
      const hidden = c.score_hidden;
      const flair = c.author_flair_text ? `<span class="rlc-flair">${esc(c.author_flair_text)}</span>` : '';
      let ctx = '';
      if (c.parent_id && c.parent_id.startsWith('t1_')) {
        const p = seen.get(c.parent_id.slice(3));
        ctx = `<div class="rlc-ctx">${p ? `<b>${esc(p.author)}</b>: ${esc(snip(p.body))}` : 'reply to an older comment'}</div>`;
      }
      const bodyHtml = c.body_html || esc(c.body).replace(/\n/g, '<br>');
      el.innerHTML =
        `<div class="rlc-meta"><a class="rlc-author" href="/user/${esc(c.author)}" target="_blank">${esc(c.author)}</a>${flair}` +
        `<span class="rlc-age" data-t="${c.created_utc}">${ago(c.created_utc)}</span>` +
        `<span class="rlc-acts">` +
        `<button class="rlc-vote" data-act="up" title="Upvote">▲</button>` +
        `<span class="rlc-score" data-base="${base}"${hidden ? ' data-hidden="1"' : ''}>${hidden ? '•' : base + likes}</span>` +
        `<button class="rlc-vote" data-act="down" title="Downvote">▼</button>` +
        `<button data-act="reply">reply</button>` +
        (c.permalink ? `<a href="https://old.reddit.com${esc(c.permalink)}" target="_blank">link</a>` : '') +
        `</span></div>` +
        `<div class="rlc-box">${ctx}<div class="rlc-body">${bodyHtml}</div></div>`;
      applyFilter(el);
      return el;
    }

    // Keep chronological order (oldest top, newest bottom) even when backfill finds a comment late.
    function insert(el, t) {
      let ref = listEl.lastElementChild;
      while (ref && +ref.dataset.t > t) ref = ref.previousElementSibling;
      listEl.insertBefore(el, ref ? ref.nextSibling : listEl.firstChild);
    }

    // Walk the tree. Collapsed reply stubs ("load more replies") get queued for /api/morechildren.
    // Top-level stubs are skipped on purpose: those are old comments, not live ones.
    function collect(children, out, depth = 0) {
      for (const ch of children || []) {
        if (ch.kind === 'more') {
          if (depth > 0) for (const cid of ch.data.children || []) if (!seen.has(cid)) moreQueue.add(cid);
          continue;
        }
        if (ch.kind !== 't1') continue;
        out.push(ch.data);
        if (ch.data.replies && ch.data.replies.data) collect(ch.data.replies.data.children, out, depth + 1);
      }
      return out;
    }

    function render(fresh) {
      if (!fresh.length) return;
      const stick = first || nearBottom();
      for (const c of fresh) insert(card(c, !first), c.created_utc);

      let removed = 0;
      while (listEl.children.length > MAX_CARDS) { removed += listEl.firstElementChild.offsetHeight; listEl.firstElementChild.remove(); }

      if (stick) {
        toBottom(false);
      } else {
        if (removed) window.scrollBy(0, -removed);
        pendingNew += fresh.length;
        newPill.textContent = `▼ ${pendingNew} new`;
        newPill.hidden = false;
      }
    }

    // ---------- polling ----------
    async function poll() {
      clearTimeout(timer);
      if (paused) return;
      const batch = [];
      const errors = [];

      if (first || !subFeed || tick % THREAD_EVERY === 0) {
        try {
          const j = await getJSON(`/comments/${id}.json?sort=new&limit=500&raw_json=1`);
          if (first) {
            const post = j[0].data.children[0].data;
            sub = post.subreddit;
            $('rlc-title').innerHTML = `<a href="https://old.reddit.com${esc(post.permalink)}" target="_blank" title="${esc(post.title)}">${esc(post.title)}</a>`;
            document.title = `RLC · ${post.title}`;
          }
          batch.push(...collect(j[1].data.children, []));
        } catch (e) { errors.push(`thread ${e.status || e.message}`); }
      }

      if (!first && sub && subFeed) {
        try {
          const f = await getJSON(`/r/${sub}/comments.json?limit=100&raw_json=1`);
          batch.push(...f.data.children.map((c) => c.data).filter((c) => c.link_id === `t3_${id}`));
        } catch (e) {
          if (e.status === 403 || e.status === 404) subFeed = false; // blocked, rely on thread polling
          else errors.push(`feed ${e.status || e.message}`);
        }
      }

      const ids = [...moreQueue].filter((x) => !seen.has(x)).slice(0, 100);
      if (ids.length) {
        ids.forEach((x) => moreQueue.delete(x));
        try {
          const m = await getJSON(`/api/morechildren.json?api_type=json&link_id=t3_${id}&children=${ids.join(',')}&sort=new&raw_json=1`);
          for (const t of m?.json?.data?.things || []) {
            if (t.kind === 't1') batch.push(t.data);
            else if (t.kind === 'more') for (const cid of t.data.children || []) if (!seen.has(cid)) moreQueue.add(cid);
          }
        } catch (e) { errors.push(`replies ${e.status || e.message}`); }
      }

      tick++;
      const fresh = [];
      for (const c of batch) if (c && c.id && !seen.has(c.id)) { seen.set(c.id, c); fresh.push(c); }
      fresh.sort((a, b) => a.created_utc - b.created_utc);
      render(fresh);
      if (seen.size || !errors.length) first = false;

      if (errors.length && !fresh.length) {
        backoff = Math.min((backoff || interval) * 2, 60);
        setStatus(`${errors.join(', ')}, retry ${backoff}s`);
      } else {
        backoff = 0;
        setStatus(`${seen.size} comments · ${clock()}${errors.length ? ` · ${errors.join(', ')}` : ''}`);
      }
      timer = setTimeout(poll, (backoff || interval) * 1000);
    }

    window.addEventListener('scroll', () => {
      if (!newPill.hidden && nearBottom()) { newPill.hidden = true; pendingNew = 0; }
    }, { passive: true });
    newPill.addEventListener('click', () => toBottom(true));
    filterEl.addEventListener('input', () => { for (const el of listEl.children) applyFilter(el); });
    themeEl.addEventListener('change', () => { applyTheme(themeEl.value); save('rlcTheme', themeEl.value); });
    sizeEl.addEventListener('change', () => {
      const stick = nearBottom();
      applySize(sizeEl.value); save('rlcSize', sizeEl.value);
      if (stick) toBottom(false);
    });
    intEl.addEventListener('change', () => { interval = +intEl.value; save('rlcInterval', String(interval)); poll(); });
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (paused) { clearTimeout(timer); setStatus('paused'); } else poll();
    });
    $('rlc-exit').addEventListener('click', () => { location.href = location.pathname; });

    setInterval(() => {
      for (const el of listEl.querySelectorAll('.rlc-age')) el.textContent = ago(+el.dataset.t);
    }, 5000);

    poll();
  }
})();
