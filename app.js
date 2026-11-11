/* Maarif Work Map v5. Reads workmap.json, classes.json and board.json from the private hub repo with the viewer's
   own GitHub key (kept in this browser only). The mentor buttons write the `workmap` section of board.json.
   Place in the page lives in the address: #week?c=zm&s=zm-1-8, #map?a=mahdaviyat&b=15&s=zm-1-8. */
(function () {
'use strict';
const OWNER = 'alimuqaddasm', HUB = 'hub', KEY = 'workmap.key';
const API = `https://api.github.com/repos/${OWNER}/${HUB}/contents/`;
const $ = s => document.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(w, hgt, d, extra) { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', `0 0 ${w} ${hgt}`); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', extra || '1.8'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.append(p); return s; }
const arrowL = () => h('span', { class: 'arw' }, svg(18, 10, 'M17 5 H2 M6 1 L2 5 L6 9'));
const arrowDown = () => h('span', { class: 'down' }, svg(10, 14, 'M5 1 V12 M1 8 L5 12 L9 8'));
const tick = () => svg(14, 14, 'M3 7.5 L6 10.5 L11 4', '2');
const dash = () => svg(14, 14, 'M4 7 H10', '1.6');
const ur = (t, cls, tag) => h(tag || 'span', { class: 'ur' + (cls ? ' ' + cls : ''), lang: 'ur', dir: 'rtl', text: t || '' });
const UD = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const setKey = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
const VIEWS = ['connect', 'loading', 'fail', 'week', 'map'];
const show = id => VIEWS.forEach(x => { $('#' + x).hidden = x !== id; });
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500); }

// ---------- GitHub contents API ----------
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
const b64enc = s => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
async function gh(path, opts) {
  let r;
  try { r = await fetch(API + path, Object.assign({ headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }, opts || {})); }
  catch (e) { const er = new Error('GitHub could not be reached. Check your connection.'); er.status = 0; throw er; }
  if (!r.ok) { const e = new Error(r.status === 401 ? 'GitHub refused the key. It may have expired or been revoked.' : r.status === 404 ? `This key cannot see ${path} in the hub repo.` : `GitHub answered ${r.status}.`); e.status = r.status; throw e; }
  return r.json();
}
async function readJson(path) { const j = await gh(path); return { sha: j.sha, data: JSON.parse(b64dec(j.content)) }; }

// ---------- state ----------
const S = { data: null, board: null, boardSha: null };
const DEL = [['tc', 'Teacher Copy'], ['handout', 'Handout'], ['refined', 'Refined handout'], ['proof', 'Print proof'], ['main', 'Main deck'], ['extra', 'Extra deck'], ['qa', 'QA deck'], ['tafseer', 'Tafseer'], ['flow', 'Flowchart'], ['research', 'Extra research'], ['audio', 'Audio'], ['reader', 'Reader']];
const stage = has => { const s = new Set(has || []); if (s.has('main') || s.has('extra') || s.has('qa')) return 'class'; if (s.has('refined') || s.has('proof')) return 'ref'; if (s.has('tc') || s.has('text')) return 'tc'; return 'plan'; };
const STAGE_NAME = { plan: 'in the hub', tc: 'Teacher Copy written', ref: 'handout refined', class: 'class-ready' };
const STAGE_W = { plan: 0, tc: 33, ref: 66, class: 100 };
const STAGE_C = { plan: 'var(--s-0)', tc: 'var(--s-1)', ref: 'var(--s-2)', class: 'var(--s)' };
const unitKey = (b, s) => `B${b} S${s}`;
const mentorOf = (cid, b, s) => (((S.board.workmap || {})[cid] || {})[unitKey(b, s)]) || null;
const M = { 'with mentor': ['with', 'with mentor'], revising: ['rev', 'revising'], final: ['fin', 'final'] };
const mText = m => !m ? '' : m.status === 'revising' ? `revising, round ${m.round || 1}` : m.status;
const atlasOf = id => S.data.atlases.find(a => a.id === id);
const courseOf = id => S.data.courses.find(c => c.id === id);
const sid = x => `${x.c.id}-${x.b.n}-${x.H.h}`;
function findS(key) { if (!key) return null; const [cid, b, s] = key.split('-'); const c = courseOf(cid); const bb = c && c.babs.find(x => x.n === +b); const H = bb && bb.hub.find(x => x.h === +s); return H ? { c, b: bb, H } : null; }
function allS(filter) { const o = []; S.data.courses.forEach(c => { if (filter && filter !== c.id) return; c.babs.forEach(b => b.hub.forEach(H => o.push({ c, b, H }))); }); return o; }
const code = x => `${x.c.code} B${x.b.n} S${x.H.h}`;
const fcode = (a, u) => { const [b, f] = u.replace('U', '').split('.'); return `${a.name} B${b} F${f}`; };
function fasl(a, u) { const [b] = u.replace('U', '').split('.'); const bb = a.babs.find(x => x.n === +b); return bb && bb.fasls.find(x => x.id === u.replace('U', '')); }

// ---------- routing ----------
function parse() { const [v, q] = location.hash.slice(1).split('?'); return { view: v === 'map' ? 'map' : 'week', p: new URLSearchParams(q || '') }; }
function go(view, params) { const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); }); const next = '#' + view + (q.toString() ? '?' + q : ''); if (location.hash === next) route(); else location.hash = next; }
function route() {
  if (!S.data) return;
  const { view, p } = parse();
  document.querySelectorAll('#tabs a').forEach(a => { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (view === 'map') renderMap(p); else renderWeek(p);
  show(view);
}
window.addEventListener('hashchange', route);

// ---------- load ----------
async function load() {
  show('loading'); $('#tabs').hidden = true; $('#forget').hidden = false;
  try {
    const [w, b] = await Promise.all([readJson('workmap.json'), readJson('board.json')]);
    S.data = w.data; S.board = b.data; S.boardSha = b.sha; if (!S.board.workmap) S.board.workmap = {};
    $('#made').textContent = 'Updated from the repos ' + S.data.made;
    $('#tabs').hidden = false; route();
  } catch (e) {
    if (e.status === 401) { setKey(''); connect(e.message); return; }
    $('#failmsg').textContent = e.message || String(e); show('fail');
  }
}
function connect(msg) { show('connect'); $('#tabs').hidden = true; $('#forget').hidden = true; $('#made').textContent = ''; $('#keyerr').hidden = !msg; $('#keyerr').textContent = msg || ''; }
$('#keyform').addEventListener('submit', e => { e.preventDefault(); const v = $('#key').value.trim(); if (!v) { connect('Paste a key first.'); return; } setKey(v); $('#key').value = ''; load(); });
$('#forget').addEventListener('click', () => { setKey(''); S.data = null; connect('Your key was removed from this browser.'); });
$('#retry').addEventListener('click', load);
$('#rekey').addEventListener('click', () => { setKey(''); connect(); });

// ---------- shared pieces ----------
function chainEl(x) {
  const a = atlasOf(x.c.atlas); const fs = x.H.fasls || [];
  return h('div', { class: 'chain' },
    fs.length ? fs.map(u => h('span', { class: 'tag f', title: (fasl(a, u) || {}).ur || '' }, fcode(a, u))) : h('span', { class: 'tag f' }, `${a.name} B${x.b.from}`),
    arrowL(), h('span', { class: 'tag s' }, code(x)),
    x.H.L ? [arrowL(), h('span', { class: 'tag l' }, `${x.c.code} B${x.b.n} L${x.H.L}`)] : null);
}
function detailEl(x, onSaved) {
  if (!x) return h('aside', { class: 'panel detail' }, h('h2', { text: 'Pick a sabaq' }),
    h('p', { class: 'empty', text: 'Click any square in the hub, or any lesson on this page. Its chain from the atlas, what it has, and the mentor buttons show here.' }));
  const a = atlasOf(x.c.atlas); const m = mentorOf(x.c.id, x.b.n, x.H.h); const has = new Set(x.H.has);
  const flow = h('div', { class: 'flow' });
  (x.H.fasls || []).forEach(u => { const f = fasl(a, u); flow.append(h('div', { class: 'node f' }, h('span', { class: 'k', text: fcode(a, u) }), ur(f ? f.ur : ''))); });
  if (!(x.H.fasls || []).length) flow.append(h('div', { class: 'node f' }, h('span', { class: 'k', text: `${a.name} B${x.b.from}` })));
  flow.append(arrowDown(), h('div', { class: 'node s' }, h('span', { class: 'k', text: `${code(x)}, ${STAGE_NAME[stage(x.H.has)]}` }), ur(x.H.ur)));
  if (x.H.L) flow.append(arrowDown(), h('div', { class: 'node l' }, h('span', { class: 'k', text: `${x.c.code} B${x.b.n} L${x.H.L}, ${x.H.Ls === 'planned' ? 'planned' : 'taught'}` })));
  const note = h('input', { id: 'mnote', type: 'text', placeholder: 'What the mentor asked for', value: m && m.note ? m.note : '' });
  const set = async status => {
    const prev = mentorOf(x.c.id, x.b.n, x.H.h);
    const round = status === 'revising' ? ((prev && prev.round) || 0) + 1 : (prev && prev.round) || 0;
    await saveMentor(x, status ? { status, round, note: note.value.trim(), updated: new Date().toISOString().slice(0, 16) } : null, onSaved);
  };
  const btn = (cls, st, label) => h('button', { type: 'button', class: 'btn ' + cls, 'aria-pressed': m && m.status === st ? 'true' : 'false', onclick: () => set(st), text: label });
  return h('aside', { class: 'panel detail', 'aria-label': 'Selected sabaq' },
    h('div', { class: 'ph' }, h('h2', { text: code(x) }), m ? h('span', { class: 'tag ' + M[m.status][0], text: mText(m) }) : null),
    flow,
    h('div', {}, h('h3', { class: 'small muted', style: 'margin-bottom:6px', text: 'What it has' }),
      h('div', { class: 'checks' }, DEL.map(([k, n]) => h('span', { class: has.has(k) ? 'yes' : '' }, has.has(k) ? tick() : dash(), n)))),
    h('div', { class: 'mentor' }, h('h3', { class: 'small muted', text: 'Mentor' }),
      h('div', { class: 'btns' }, btn('with', 'with mentor', 'Sent to mentor'), btn('rev', 'revising', 'Mentor wants changes'), btn('fin', 'final', 'Final'),
        m ? h('button', { type: 'button', class: 'link', onclick: () => set(null), text: 'Clear' }) : null),
      h('label', { for: 'mnote', class: 'small muted', text: "Mentor's note, saved with the next button you press" }), note,
      m ? h('span', { class: 'small muted', text: `Last set ${m.updated} UTC` }) : null));
}
function legendS() {
  return h('div', { class: 'legend' },
    h('span', {}, h('i', { class: 'sw', style: 'background:var(--s-0)' }), 'in the hub'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--s-1)' }), 'Teacher Copy'),
    h('span', {}, h('i', { class: 'sw', style: 'background:var(--s-2)' }), 'refined'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--s)' }), 'class-ready'),
    h('span', {}, h('i', { class: 'sw', style: 'box-shadow:inset 0 0 0 2px var(--l)' }), 'class lesson'),
    h('span', {}, h('i', { class: 'sw', style: 'background:var(--m-with)' }), 'with mentor'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--m-rev)' }), 'revising'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--m-final)' }), 'final'));
}

// ---------- This week ----------
function renderWeek(p) {
  const root = $('#week'); root.replaceChildren();
  const filter = p.get('c') || ''; const sel = findS(p.get('s'));
  const goSel = x => go('week', { c: filter, s: x ? sid(x) : '' });
  const all = allS(filter);
  const planned = all.filter(x => x.H.L && x.H.Ls === 'planned').sort((a, b) => a.H.L - b.H.L);
  const taught = all.filter(x => x.H.L && x.H.Ls !== 'planned').sort((a, b) => a.c.id.localeCompare(b.c.id) || a.H.L - b.H.L);
  const ment = st => all.filter(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); return m && m.status === st; });
  const decisions = [];
  ment('revising').forEach(x => decisions.push({ x, code: `${code(x)}, mentor wants changes`, body: mentorOf(x.c.id, x.b.n, x.H.h).note || 'See the note on the sabaq' }));
  S.data.atlases.forEach(a => a.babs.forEach(b => { if (b.branch && (b.branch.counts.refined || 0) > 20) decisions.push({ code: `${a.name} B${b.n}`, body: `${b.branch.counts.refined} Fasl lessons refined on a branch, waiting for your review` }); }));

  const courses = S.data.courses;
  root.append(h('div', { class: 'head' }, h('h1', { text: 'This week' }),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Course' },
      h('button', { type: 'button', 'aria-pressed': filter ? 'false' : 'true', onclick: () => go('week', { s: p.get('s') }), text: 'All courses' }),
      courses.map(c => h('button', { type: 'button', 'aria-pressed': filter === c.id ? 'true' : 'false', onclick: () => go('week', { c: c.id, s: p.get('s') }) }, ur(c.ur))))));

  const main = h('div', { class: 'wk-main' });
  const nx = planned[0];
  if (nx) {
    const has = new Set(nx.H.has); const need = [['refined', 'Refined handout'], ['proof', 'Print proof'], ['main', 'Main deck'], ['extra', 'Extra deck']];
    main.append(h('section', { class: 'panel next', 'aria-label': 'Next class' },
      h('div', { class: 'ph' }, h('h2', { text: `Next class: ${nx.c.code} B${nx.b.n} L${nx.H.L}` }), h('button', { type: 'button', class: 'link', onclick: () => goSel(nx), text: 'Open its panel' })),
      ur(nx.H.ur, 't', 'p'), chainEl(nx),
      h('div', { class: 'needs' }, h('span', { class: 'small muted', text: 'Still to make:' }), need.filter(([k]) => !has.has(k)).map(([, n]) => h('span', { class: 'tag plain', text: n })),
        need.every(([k]) => has.has(k)) ? h('span', { class: 'tag fin', text: 'nothing, ready to teach' }) : null)));
  } else main.append(h('section', { class: 'panel' }, h('h2', { text: 'No next class planned' }), h('p', { class: 'empty', text: 'Ask Claude to "teach ZM B1 S12 as L6" and it appears here.' })));

  const item = (x, codeTxt, body, isUr) => {
    const kids = [h('span', { class: 'code', text: codeTxt }), isUr ? ur(body) : h('span', { text: body })];
    return x ? h('button', { type: 'button', class: 'item', 'aria-pressed': sel && sid(sel) === sid(x) ? 'true' : 'false', onclick: () => goSel(x) }, kids) : h('div', { class: 'item' }, kids);
  };
  const box = (title, items, empty) => h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', { text: title }), h('span', { class: 'muted small', text: String(items.length) })),
    items.length ? h('div', { class: 'list' }, items.slice(0, 5)) : h('p', { class: 'empty', text: empty }));
  main.append(h('div', { class: 'cols3' },
    box('Then', planned.slice(1).map(x => item(x, `${x.c.code} B${x.b.n} L${x.H.L}, from S${x.H.h}`, x.H.ur, true)), 'Nothing more is planned yet.'),
    box('Needs you', decisions.map(d => item(d.x, d.code, d.body, false)), 'Nothing is waiting for you.'),
    box('With the mentor', ment('with mentor').map(x => item(x, code(x) + (x.H.L ? `, L${x.H.L}` : ''), x.H.ur, true)), 'Nothing is with the mentor. Open a sabaq and press Sent to mentor.')));
  main.append(h('div', { class: 'cols3', style: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' },
    box('Class lessons taught', taught.map(x => item(x, `${x.c.code} B${x.b.n} L${x.H.L}, from S${x.H.h}`, x.H.ur, true)), 'No class lesson is marked taught.'),
    box('Changed in the last day', (S.data.changes || []).map(c => h('div', { class: 'item' }, h('span', { class: 'code', text: `${c.repo}, ${c.ref === 'main' ? 'main' : 'branch ' + c.ref}` }), h('span', { text: `${c.n} commit${c.n === 1 ? '' : 's'}. ${c.last}` }))), 'No commits in the last 24 hours.')));

  const rows = h('div', { class: 'hubrows' });
  courses.filter(c => !filter || c.id === filter).forEach(c => c.babs.forEach(b => {
    if (!b.hub.length) return;
    const a = atlasOf(c.atlas); const ab = a.babs.find(x => x.n === b.from);
    const done = b.hub.filter(H => ['ref', 'class'].includes(stage(H.has))).length;
    rows.append(h('div', { class: 'hubrow' },
      h('div', { class: 'nm' }, h('b', { text: `${c.code} B${b.n}` }), ur(ab ? ab.ur : '')),
      h('div', { class: 'sq', role: 'group', 'aria-label': `${c.code} B${b.n} sabaq` }, b.hub.map(H => {
        const x = { c, b, H }; const m = mentorOf(c.id, b.n, H.h); const st = stage(H.has);
        return h('button', { type: 'button', class: `sqb st-${st}${H.L ? ' isL' : ''}`, title: H.ur, 'aria-pressed': sel && sid(sel) === sid(x) ? 'true' : 'false',
          'aria-label': `${code(x)}, ${STAGE_NAME[st]}${H.L ? ', class lesson L' + H.L : ''}${m ? ', ' + mText(m) : ''}`, onclick: () => goSel(x) },
          String(H.h), m ? h('i', { class: 'm ' + M[m.status][0] }) : null);
      })),
      h('span', { class: 'sum', text: `${done} of ${b.hub.length} done` })));
  }));
  main.append(h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', { text: 'Every hub sabaq' }), legendS()), rows));
  root.append(h('div', { class: 'wk-grid' }, main, detailEl(sel, () => route())));
}

// ---------- Map ----------
function renderMap(p) {
  const root = $('#map'); root.replaceChildren();
  const aid = p.get('a') || 'mahdaviyat'; const a = atlasOf(aid) || atlasOf('mahdaviyat');
  const feeds = {}; S.data.courses.forEach(c => c.babs.forEach(b => { feeds[c.atlas + ':' + b.from] = { c, b }; }));
  const firstHub = a.babs.find(b => feeds[a.id + ':' + b.n] && feeds[a.id + ':' + b.n].b.hub.length);
  const bn = +(p.get('b') || (firstHub ? firstHub.n : a.babs[0].n));
  const bab = a.babs.find(b => b.n === bn) || a.babs[0];
  const sel = findS(p.get('s'));
  const goMap = (o) => go('map', Object.assign({ a: a.id, b: bab.n, s: sel ? sid(sel) : '' }, o));

  root.append(h('div', { class: 'head' }, h('h1', { text: 'Map' }), h('p', { class: 'muted', text: 'Atlas Fasls become hub sabaq, and hub sabaq become class lessons. Pick an atlas, then a Bab.' })));
  const order = ['mahdaviyat', 'tauheed', 'akhlaq', 'adl', 'maad', 'nubuwat', 'imamat'];
  root.append(h('div', { class: 'atlases', role: 'group', 'aria-label': 'Atlas' }, order.map(atlasOf).filter(Boolean).map(at => {
    const cs = S.data.courses.filter(c => c.atlas === at.id);
    return h('button', { type: 'button', class: 'atlas', 'aria-pressed': at.id === a.id ? 'true' : 'false', onclick: () => go('map', { a: at.id }) },
      ur(at.ur), h('span', { class: 'sub', text: at.state === 'done' ? `${at.babs.length} Babs${cs.length ? ', feeds ' + cs.map(c => c.code).join(', ') : ''}` : `${at.babs.length} Babs, being built` }),
      h('span', { class: 'cells' }, at.babs.map(b => { const fe = feeds[at.id + ':' + b.n]; let k = ''; if (fe) { const st = fe.b.hub.map(H => stage(H.has)); k = !fe.b.hub.length ? 'p' : st.some(s => s === 'ref' || s === 'class') ? 'k' : st.some(s => s === 'tc') ? 't' : 'h'; } return h('i', { class: k, title: `B${b.n}` }); })));
  })));

  // Bab list
  const list = h('div', { class: 'panel bablist', role: 'group', 'aria-label': `${a.name} Babs` }, a.babs.map(b => {
    const st = b.fasls.map(f => f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).length ? 'o' : '').filter(Boolean);
    const n = st.length; const cnt = k => st.filter(x => x === k).length;
    const fe = feeds[a.id + ':' + b.n];
    return h('button', { type: 'button', class: 'bab', 'aria-pressed': b.n === bab.n ? 'true' : 'false', onclick: () => go('map', { a: a.id, b: b.n }) },
      h('span', { class: 'n', text: 'باب ' + UD(b.n) }),
      h('span', { class: 'ttl' }, ur(b.ur), h('span', { class: 'ln' },
        h('span', { class: 'bar' }, n ? [['b', 'var(--f)'], ['w', 'var(--f-2)'], ['br', 'var(--f-stripe)']].map(([k, c]) => cnt(k) ? h('span', { style: `width:${100 * cnt(k) / n}%;background:${c}` }) : null) : null),
        fe ? h('span', { class: 'hub', style: `color:${fe.b.hub.some(H => H.L) ? 'var(--l-ink)' : 'var(--s-ink)'}`, text: `${fe.c.code} B${fe.b.n}` }) : null)));
  }));

  // Bab detail: Fasl, sabaq, class lesson
  const fe = feeds[a.id + ':' + bab.n];
  const hiF = new Set(sel && fe && sel.c.id === fe.c.id && sel.b.n === fe.b.n ? (sel.H.fasls || []).map(u => u.replace('U', '')) : []);
  const st = bab.fasls.map(f => f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).length ? 'o' : '');
  const det = h('div', { style: 'display:flex;flex-direction:column;gap:14px;min-width:0' });
  det.append(h('section', { class: 'panel' }, h('div', { class: 'babhead' },
    h('div', { style: 'display:flex;flex-direction:column' }, ur(`${a.ur}، باب ${UD(bab.n)}`, 'muted'), ur(bab.ur, 'big')),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', { text: String(bab.fasls.length || '') || 'not yet' }), h('span', { text: 'Fasls' })),
      st.some(Boolean) ? h('div', { class: 'stat' }, h('b', { text: `${st.filter(x => x === 'b').length} of ${st.filter(Boolean).length}` }), h('span', { text: 'atlas lessons built' })) : null,
      fe ? h('div', { class: 'stat' }, h('b', { text: String(fe.b.hub.length || 0) }), h('span', { text: `sabaq in ${fe.c.code} B${fe.b.n}` })) : null,
      fe && fe.b.hub.some(H => H.L) ? h('div', { class: 'stat' }, h('b', { text: String(fe.b.hub.filter(H => H.L).length) }), h('span', { text: 'class lessons' })) : null)),
    bab.note ? h('p', { class: 'note', style: 'margin-top:12px', text: bab.note }) : null));

  const fcol = h('section', { class: 'panel colp f' }, h('div', { class: 'ph' }, ur('فصل'), h('span', { class: 'k', text: `${a.name} B${bab.n}, F` })));
  if (bab.fasls.length) bab.fasls.forEach((f, i) => {
    const s = st[i]; const tg = s === 'br' ? h('span', { class: 'tag branch', text: 'branch' }) : s === 'b' ? h('span', { class: 'tag f', text: 'built' }) : s === 'w' ? h('span', { class: 'tag f', text: 'written' }) : s === 'o' ? h('span', { class: 'tag plain', text: 'not started' }) : h('span', { class: 'tag plain', text: 'not M1' });
    fcol.append(h('div', { class: 'frow' + (hiF.has(f.id) ? ' hi' : '') }, h('span', { class: 'c', text: 'F' + f.id.split('.')[1] }), ur(f.ur), tg));
  }); else fcol.append(h('p', { class: 'empty', text: a.state === 'done' ? 'No Fasls listed.' : 'Fasls are still being found by the atlas run.' }));

  const scol = h('section', { class: 'panel colp s' }, h('div', { class: 'ph' }, ur('سبق'), h('span', { class: 'k', text: fe ? `Hub ${fe.c.code} B${fe.b.n}, S` : 'Hub' })));
  if (fe && fe.b.hub.length) fe.b.hub.forEach(H => {
    const x = { c: fe.c, b: fe.b, H }; const s = stage(H.has); const m = mentorOf(fe.c.id, fe.b.n, H.h);
    scol.append(h('button', { type: 'button', class: 'scard' + (H.L ? ' isL' : ''), 'aria-pressed': sel && sid(sel) === sid(x) ? 'true' : 'false', onclick: () => goMap({ s: sid(x) }) },
      h('span', { class: 'r1' }, ur('سبق ' + UD(H.h)), h('span', { class: 'fr', text: (H.fasls || []).map(u => 'F' + u.split('.')[1]).join(', ') })),
      ur(H.ur, 't'), h('span', { class: 'prog' }, h('span', { style: `width:${Math.max(STAGE_W[s], 4)}%;background:${STAGE_C[s]}` })),
      m ? h('span', { class: 'tag ' + M[m.status][0], style: 'align-self:flex-end', text: mText(m) }) : null));
  }); else scol.append(h('p', { class: 'empty', text: fe ? `${fe.c.code} B${fe.b.n}: ${fe.b.hub_state}.` : 'This Bab has not been made into a hub yet.' }));

  const lcol = h('section', { class: 'panel colp l' }, h('div', { class: 'ph' }, ur('درس'), h('span', { class: 'k', text: fe ? `Class ${fe.c.code} B${fe.b.n}, L` : 'Class' })));
  const ls = fe ? fe.b.hub.filter(H => H.L).sort((p1, p2) => p1.L - p2.L) : [];
  const lrow = h('div', { class: 'lrow' }); lcol.append(lrow);
  if (ls.length) ls.forEach(H => lrow.append(h('div', { class: 'lcard' + (H.Ls === 'planned' ? ' planned' : '') + (sel && sel.H === H ? ' hi' : '') },
    h('span', { class: 'r1' }, h('span', { text: H.Ls === 'planned' ? 'planned' : 'taught' }), h('b', {}, `L${H.L} `, h('span', { class: 'muted small', text: `from S${H.h}` }))), ur(H.ur))));
  else lrow.replaceWith(h('p', { class: 'empty', text: 'No class lesson is picked from this Bab yet.' }));
  det.append(h('div', { class: 'flow3' }, fcol, scol, lcol));
  if (sel && fe && sel.c.id === fe.c.id && sel.b.n === fe.b.n) det.append(detailEl(sel, () => route()));
  root.append(h('div', { class: 'mapgrid' }, list, det));

  // Maarif courses not from an atlas
  const m = S.data.muqaddima, z = S.data.tazzakur;
  root.append(h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', { text: 'Muqaddima' }), ur(m.ur)),
    h('p', { class: 'small muted', style: 'margin-bottom:8px', text: 'Written from its own source book, Maarif Zamina, not from an atlas.' }),
    h('div', { class: 'scroll' }, h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Lesson' }), h('th', { text: 'Title' }), h('th', { text: 'What it has' })),
      m.lessons.map(l => h('tr', {}, h('td', { text: l.code }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: l.ur }), h('td', {}, h('div', { class: 'chips' }, DEL.filter(([k]) => l.has.includes(k)).map(([, n]) => h('span', { class: 'tag s', text: n }))))))))));
  root.append(h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', { text: 'Tazzakur, class LMM-01' })),
    h('div', { class: 'scroll' }, h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Session' }), h('th', { text: 'Date' }), h('th', { text: 'Starts from' }), h('th', { text: 'Anchor' }), h('th', { text: 'State' })),
      z.sessions.map(s => h('tr', {}, h('td', { text: s.code }), h('td', { text: s.date }), h('td', { text: s.kind }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: s.ur }), h('td', { text: s.state })))))));
}

// ---------- mentor marks ----------
let saving = false;
async function saveMentor(x, entry, after) {
  if (saving) return; saving = true;
  const cid = x.c.id, key = unitKey(x.b.n, x.H.h);
  document.querySelectorAll('.mentor .btn').forEach(b => { b.disabled = true; });
  const apply = board => { board.workmap = board.workmap || {}; board.workmap[cid] = board.workmap[cid] || {}; if (entry) board.workmap[cid][key] = entry; else delete board.workmap[cid][key]; return board; };
  const put = (board, sha) => gh('board.json', { method: 'PUT', headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Work Map: ${cid} ${key} ${entry ? entry.status : 'cleared'}`, content: b64enc(JSON.stringify(board, null, 1) + '\n'), sha, branch: 'main' }) });
  try {
    let res;
    try { res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    catch (e) { if (e.status !== 409 && e.status !== 422) throw e; const fresh = await readJson('board.json'); S.board = fresh.data; S.boardSha = fresh.sha; res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    apply(S.board); S.boardSha = res.content.sha;
    toast(entry ? `Saved. ${code(x)} is ${mText(entry)}.` : `Cleared the mark on ${code(x)}.`);
    after && after();
  } catch (e) {
    toast(e.status === 403 || e.status === 404 ? 'Not saved. The key can read but not write: give it Contents, read and write.' : 'Not saved. ' + (e.message || e));
    document.querySelectorAll('.mentor .btn').forEach(b => { b.disabled = false; });
  } finally { saving = false; }
}

// ---------- start ----------
if (getKey()) load(); else connect();
})();
