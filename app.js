/* Maarif Work Map (v4 design). Reads workmap.json and board.json from the private hub repo with the viewer's own
   GitHub key (kept in this browser only). The mentor buttons write the `workmap` section of board.json.
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
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach(k => e.append(k)); return e; }
const icon = (w, hh, d, sw) => sv('svg', { viewBox: `0 0 ${w} ${hh}`, 'aria-hidden': 'true' }, sv('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': sw || '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
const arrowL = () => h('span', { class: 'arw' }, icon(18, 10, 'M17 5 H2 M6 1 L2 5 L6 9'));
const arrowD = () => h('span', { class: 'down' }, icon(10, 14, 'M5 1 V12 M1 8 L5 12 L9 8'));
function ring(p) {
  const r = 10, c = 2 * Math.PI * r;
  return sv('svg', { viewBox: '0 0 26 26', 'aria-hidden': 'true' },
    sv('circle', { cx: 13, cy: 13, r, fill: 'none', style: 'stroke:var(--line)', 'stroke-width': 4 }),
    sv('circle', { cx: 13, cy: 13, r, fill: 'none', style: 'stroke:var(--s)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': `${(c * p).toFixed(1)} 100`, transform: 'rotate(-90 13 13)' }));
}
const ur = (t, cls, tag) => h(tag || 'span', { class: 'ur' + (cls ? ' ' + cls : ''), lang: 'ur', dir: 'rtl', text: t || '' });
const UD = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const setKey = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
const SCREENS = ['connect', 'fail', 'app', 'loading'];
const screen = id => SCREENS.forEach(x => { $('#' + x).hidden = x !== id; });
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500); }

// ---------- GitHub ----------
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

// ---------- data helpers ----------
const S = { data: null, board: null, boardSha: null };
const DEL = [['tc', 'Teacher Copy', 'write'], ['handout', 'Handout', 'write'], ['refined', 'Refined handout', 'ref'], ['proof', 'Print proof', 'ref'],
  ['main', 'Main deck', 'deck'], ['extra', 'Extra deck', 'deck'], ['qa', 'QA deck', 'deck'], ['tafseer', 'Tafseer', 'sup'], ['flow', 'Flowchart', 'sup'],
  ['research', 'Extra research', 'sup'], ['audio', 'Audio', 'media'], ['reader', 'Reader', 'media']];
const chipsOf = has => { const s = new Set(has || []); return h('div', { class: 'chips' }, DEL.filter(([k]) => s.has(k)).map(([, n, kind]) => h('span', { class: 'dchip ' + kind, text: n }))); };
const stage = has => { const s = new Set(has || []); if (s.has('main') || s.has('extra') || s.has('qa')) return 'cls'; if (s.has('refined') || s.has('proof')) return 'ref'; if (s.has('tc') || s.has('text')) return 'tc'; return 'plan'; };
const STAGE_NAME = { plan: 'in the hub', tc: 'Teacher Copy written', ref: 'handout refined', cls: 'class-ready' };
const unitKey = (b, s) => `B${b} S${s}`;
const mentorOf = (cid, b, s) => (((S.board.workmap || {})[cid] || {})[unitKey(b, s)]) || null;
const MK = { 'with mentor': 'with', revising: 'rev', final: 'fin' };
const mText = m => !m ? '' : m.status === 'revising' ? `revising, round ${m.round || 1}` : m.status;
const atlasOf = id => S.data.atlases.find(a => a.id === id);
const courseOf = id => S.data.courses.find(c => c.id === id);
const sid = x => `${x.c.id}-${x.b.n}-${x.H.h}`;
function findS(k) { if (!k) return null; const [cid, b, s] = k.split('-'); const c = courseOf(cid); const bb = c && c.babs.find(x => x.n === +b); const H = bb && bb.hub.find(x => x.h === +s); return H ? { c, b: bb, H } : null; }
const allS = f => { const o = []; S.data.courses.forEach(c => { if (f && f !== c.id) return; c.babs.forEach(b => b.hub.forEach(H => o.push({ c, b, H }))); }); return o; };
const code = x => `${x.c.code} B${x.b.n} S${x.H.h}`;
const fcode = (a, u) => { const [b, f] = u.replace('U', '').split('.'); return `${a.name} B${b} F${f}`; };
const fasl = (a, u) => { const [b] = u.replace('U', '').split('.'); const bb = a.babs.find(x => x.n === +b); return bb && bb.fasls.find(x => x.id === u.replace('U', '')); };

// ---------- routing ----------
function parse() { const [v, q] = location.hash.slice(1).split('?'); return { view: v === 'map' ? 'map' : 'week', p: new URLSearchParams(q || '') }; }
function go(view, params) { const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); }); const next = '#' + view + (q.toString() ? '?' + q : ''); if (location.hash === next) route(); else location.hash = next; }
function route() { if (!S.data) return; const { view, p } = parse(); side(view, p); if (view === 'map') renderMap(p); else renderWeek(p); screen('app'); }
window.addEventListener('hashchange', route);

// ---------- load ----------
async function load() {
  screen('loading');
  try {
    const [w, b] = await Promise.all([readJson('workmap.json'), readJson('board.json')]);
    S.data = w.data; S.board = b.data; S.boardSha = b.sha; if (!S.board.workmap) S.board.workmap = {};
    route();
  } catch (e) {
    if (e.status === 401) { setKey(''); connect(e.message); return; }
    $('#failmsg').textContent = e.message || String(e); screen('fail');
  }
}
function connect(msg) { screen('connect'); $('#keyerr').hidden = !msg; $('#keyerr').textContent = msg || ''; }
$('#keyform').addEventListener('submit', e => { e.preventDefault(); const v = $('#key').value.trim(); if (!v) { connect('Paste a key first.'); return; } setKey(v); $('#key').value = ''; load(); });
$('#retry').addEventListener('click', load);
$('#rekey').addEventListener('click', () => { setKey(''); connect(); });

// ---------- sidebar ----------
function side(view, p) {
  const el = $('#side'); el.replaceChildren();
  el.append(h('a', { class: 'brand', href: '#week' }, h('span', { class: 'mk' }, icon(16, 16, 'M2 11 L6 6 L9 9 L14 3', '2')), 'Work Map'));
  el.append(h('nav', { class: 'snav', 'aria-label': 'Views' },
    h('a', { href: '#week', 'aria-current': view === 'week' ? 'page' : null, text: 'This week' }),
    h('a', { href: '#map', 'aria-current': view === 'map' ? 'page' : null, text: 'Map' })));
  if (view === 'week') {
    const f = p.get('c') || '';
    el.append(h('div', { class: 'sgroup' }, h('span', { class: 'kick', text: 'Courses' }), S.data.courses.map(c => {
      const hub = c.babs.reduce((n, b) => n + b.hub.length, 0);
      const tc = c.babs.reduce((n, b) => n + b.hub.filter(H => stage(H.has) !== 'plan').length, 0);
      const L = c.babs.reduce((n, b) => n + b.hub.filter(H => H.L && H.Ls !== 'planned').length, 0);
      return h('button', { type: 'button', class: 'course', 'aria-pressed': f === c.id ? 'true' : 'false', title: `${tc} of ${hub} sabaq have a Teacher Copy`, onclick: () => go('week', { c: f === c.id ? '' : c.id }) },
        ring(hub ? tc / hub : 0), h('span', { class: 'tx' }, ur(c.ur), h('span', { class: 'm', text: `${c.babs.length} Babs, ${hub} S, ${L ? L + ' L taught' : tc + ' written'}` })));
    })));
  } else {
    el.append(h('div', { class: 'sgroup' }, h('span', { class: 'kick', text: 'The four scholars' }),
      [['میرزا مہدی اصفہانی', '17 Arabic books'], ['آقائے حلبی', '212 lectures, 1 book'], ['آیت اللہ سید جعفر سیدان', '2,532 lectures, 14 books'], ['سید حسن افتخارزادہ', '3,122 lectures, 13 books']]
        .map(([n, s]) => h('div', { class: 'sch' }, ur(n), h('span', { text: s })))));
  }
  const sw = st => h('i', { class: 'sw', style: st });
  el.append(h('div', { class: 'key' }, h('span', { class: 'kick', text: 'Colour key' }),
    h('span', {}, sw('background:var(--f)'), 'Atlas Fasl (F): blue'), h('span', {}, sw('background:var(--s)'), 'Hub sabaq (S): teal'),
    h('span', {}, sw('background:var(--l)'), 'Class lesson (L): gold'), h('span', {}, sw('background:linear-gradient(90deg,var(--s-1),var(--s))'), 'Lighter to darker: further along'),
    h('span', {}, sw('background:var(--f-stripe)'), 'Striped: only on a branch'), h('span', {}, sw('background:var(--m-with)'), 'With mentor'),
    h('span', {}, sw('background:var(--m-rev)'), 'Needs you: revising, decisions'), h('span', {}, sw('background:var(--m-final)'), 'Final')));
  el.append(h('div', { class: 'foot' }, h('span', { class: 'when', text: `Updated from the repos ${S.data.made}` }),
    h('button', { type: 'button', class: 'linkbtn', onclick: () => { setKey(''); S.data = null; connect('Your key was removed from this browser.'); }, text: 'Forget my key' })));
}

// ---------- the selected sabaq ----------
function detail(x) {
  const a = atlasOf(x.c.atlas); const m = mentorOf(x.c.id, x.b.n, x.H.h); const has = new Set(x.H.has);
  const flow = h('div', { class: 'flow' });
  (x.H.fasls || []).forEach(u => { const f = fasl(a, u); flow.append(h('div', { class: 'node f' }, h('span', { class: 'k', text: fcode(a, u) }), ur(f ? f.ur : ''))); });
  if (!(x.H.fasls || []).length) flow.append(h('div', { class: 'node f' }, h('span', { class: 'k', text: `${a.name} B${x.b.from}` })));
  flow.append(arrowD(), h('div', { class: 'node s' }, h('span', { class: 'k', text: `${code(x)}, ${STAGE_NAME[stage(x.H.has)]}` }), ur(x.H.ur)));
  if (x.H.L) flow.append(arrowD(), h('div', { class: 'node l' }, h('span', { class: 'k', text: `${x.c.code} B${x.b.n} L${x.H.L}, ${x.H.Ls === 'planned' ? 'planned' : 'taught'}` })));
  const note = h('input', { id: 'mnote', type: 'text', placeholder: 'What the mentor asked for', value: m && m.note ? m.note : '' });
  const set = st => { const prev = mentorOf(x.c.id, x.b.n, x.H.h); const round = st === 'revising' ? ((prev && prev.round) || 0) + 1 : (prev && prev.round) || 0;
    saveMentor(x, st ? { status: st, round, note: note.value.trim(), updated: new Date().toISOString().slice(0, 16) } : null); };
  const b = (cls, st, label) => h('button', { type: 'button', class: 'btn ' + cls, 'aria-pressed': m && m.status === st ? 'true' : 'false', onclick: () => set(st), text: label });
  return h('section', { class: 'card', id: 'detail', dir: 'ltr', 'aria-label': 'Selected sabaq' },
    h('div', { class: 'ch' }, h('span', { class: 'kick', text: `Selected: ${code(x)}` }), m ? h('span', { class: 'tag ' + MK[m.status], text: mText(m) }) : null),
    h('div', { class: 'dgrid' }, flow,
      h('div', { style: 'display:flex;flex-direction:column;gap:14px' },
        h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('span', { class: 'kick', text: 'What it has' }),
          h('div', { class: 'chips' }, DEL.map(([k, n, kind]) => h('span', { class: 'dchip ' + (has.has(k) ? kind : 'no'), text: n })))),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, h('span', { class: 'kick', text: 'Mentor' }),
          h('div', { class: 'mbtns' }, b('with', 'with mentor', 'Sent to mentor'), b('rev', 'revising', 'Mentor wants changes'), b('fin', 'final', 'Final'),
            m ? h('button', { type: 'button', class: 'linkbtn', onclick: () => set(null), text: 'Clear' }) : null),
          h('label', { for: 'mnote', class: 'small muted', text: "Mentor's note, saved with the next button you press" }), note,
          m ? h('span', { class: 'small muted', text: `Last set ${m.updated} UTC` }) : null))));
}

// ---------- This week ----------
function renderWeek(p) {
  const v = $('#view'); v.replaceChildren();
  const f = p.get('c') || ''; const sel = findS(p.get('s'));
  const pick = x => { S.scroll = true; go('week', { c: f, s: x ? sid(x) : '' }); };
  const all = allS(f);
  const planned = all.filter(x => x.H.L && x.H.Ls === 'planned').sort((a, b) => a.H.L - b.H.L);
  const taught = all.filter(x => x.H.L && x.H.Ls !== 'planned').sort((a, b) => a.c.id.localeCompare(b.c.id) || a.H.L - b.H.L);
  const with_ = all.filter(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); return m && m.status === 'with mentor'; });
  const decisions = [];
  all.forEach(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); if (m && m.status === 'revising') decisions.push({ x, b: `${code(x)}: mentor wants changes`, s: m.note || 'See the note on the sabaq' }); });
  if (!f || f === 'zm') S.data.atlases.forEach(a => a.babs.forEach(b => { if (b.branch && (b.branch.counts.refined || 0) > 20) decisions.push({ b: `${a.name} B${b.n}: ${b.branch.counts.refined} Fasl lessons waiting for review`, s: 'Arabic checks and a decisions list, on a branch' }); }));
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  v.append(h('header', { class: 'head' }, h('div', { style: 'display:flex;flex-direction:column;gap:4px' }, h('span', { class: 'date', text: date }), h('h1', { text: 'This week' })),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Course' }, h('button', { type: 'button', 'aria-pressed': f ? 'false' : 'true', onclick: () => go('week', {}), text: 'All' }),
      S.data.courses.map(c => h('button', { type: 'button', 'aria-pressed': f === c.id ? 'true' : 'false', onclick: () => go('week', { c: c.id }), text: c.code })))));

  const bento = h('section', { class: 'bento' });
  const nx = planned[0];
  if (nx) {
    const a = atlasOf(nx.c.atlas); const has = new Set(nx.H.has);
    const need = [['tc', 'Teacher Copy'], ['handout', 'Handout'], ['refined', 'Refined handout'], ['proof', 'Print proof'], ['main', 'Main deck'], ['extra', 'Extra deck']];
    bento.append(h('div', { class: 'hero span4' },
      h('div', { class: 'top' }, h('span', { class: 'kick', text: 'Next class' }), h('span', { class: 'meta', text: `${nx.c.code} B${nx.b.n} L${nx.H.L}, from S${nx.H.h}, ${STAGE_NAME[stage(nx.H.has)]}` })),
      ur(nx.H.ur, 't', 'p'),
      h('div', { class: 'chain' }, (nx.H.fasls || []).length ? h('span', { class: 'pill f', text: `${a.name} B${nx.b.from} ` + nx.H.fasls.map(u => 'F' + u.split('.')[1]).join(', ') }) : null,
        arrowL(), h('span', { class: 'pill s', text: code(nx) }), arrowL(), h('span', { class: 'pill l', text: `${nx.c.code} B${nx.b.n} L${nx.H.L}` })),
      h('div', { class: 'needs' }, need.map(([k, n]) => h('span', { class: has.has(k) ? 'ok' : '', text: has.has(k) ? n + ' ✓' : n })),
        h('button', { type: 'button', class: 'open', style: 'margin-left:auto', onclick: () => pick(nx), text: 'Open its details' }))));
  } else bento.append(h('div', { class: 'card span4' }, h('span', { class: 'kick', text: 'Next class' }), h('p', { class: 'empty', text: 'No class lesson is planned. Ask Claude to "teach ZM B1 S12 as L6" and it shows here.' })));
  bento.append(h('div', { class: 'stack span2' },
    h('div', { class: 'card', style: 'flex:1' }, h('span', { class: 'kick', text: 'Then' }),
      planned.length > 1 ? planned.slice(1, 4).map(x => h('button', { type: 'button', class: 'row', onclick: () => pick(x) }, h('span', { class: 'code', text: `${x.c.code} B${x.b.n} L${x.H.L}, from S${x.H.h}` }), ur(x.H.ur))) : h('p', { class: 'empty', text: 'Nothing more is planned yet.' })),
    h('div', { class: 'needsyou' }, h('span', { class: 'kick', text: 'Needs you' }),
      decisions.length ? decisions.slice(0, 3).map(d => h(d.x ? 'button' : 'div', { class: 'it', type: d.x ? 'button' : null, style: d.x ? 'all:unset;cursor:pointer;display:flex;flex-direction:column' : null, onclick: d.x ? () => pick(d.x) : null }, h('b', { text: d.b }), h('span', { class: 's2', text: d.s }))) : h('span', { class: 's2', text: 'Nothing is waiting for you.' }))));
  bento.append(h('div', { class: 'card span3' }, h('div', { class: 'ch' }, h('span', { class: 'kick', text: 'Class lessons taught' }), h('span', { class: 'small muted', text: S.data.courses.map(c => `${c.code} ${taught.filter(x => x.c.id === c.id).length}`).filter(s => !s.endsWith(' 0')).join(', ') })),
    taught.length ? taught.map(x => h('button', { type: 'button', class: 'taught', onclick: () => pick(x) }, h('span', { class: 'Lb', text: 'L' + x.H.L }), ur(x.H.ur), h('span', { class: 'c', text: code(x) }))) : h('p', { class: 'empty', text: 'No class lesson is marked taught yet.' })));
  const ch = S.data.changes || [];
  bento.append(h('div', { class: 'card span3' }, h('div', { class: 'ch' }, h('span', { class: 'kick', text: 'Changed in the last day' }), h('span', { class: 'small muted', text: `${ch.length} branches` })),
    ch.length ? ch.slice(0, 5).map(c => h('div', { class: 'chg' }, h('i', { class: c.ref === 'main' ? '' : 'br' }), h('span', { text: `${c.repo}${c.ref === 'main' ? '' : ', branch ' + c.ref}: ${c.last}` }), h('em', { text: c.when.slice(11) }))) : h('p', { class: 'empty', text: 'No commits in the last 24 hours.' })));
  v.append(bento);

  const rows = h('div', { style: 'display:flex;flex-direction:column;gap:16px' });
  S.data.courses.filter(c => !f || c.id === f).forEach(c => c.babs.forEach(b => {
    if (!b.hub.length) return;
    const a = atlasOf(c.atlas); const ab = a.babs.find(x => x.n === b.from);
    const done = b.hub.filter(H => ['ref', 'cls'].includes(stage(H.has))).length;
    rows.append(h('div', { class: 'hrow' }, h('div', { class: 'nm' }, h('b', { text: `${c.code} B${b.n}` }), ur(ab ? ab.ur : '')),
      h('div', { class: 'cells', role: 'group', 'aria-label': `${c.code} B${b.n}` }, b.hub.map(H => {
        const x = { c, b, H }; const m = mentorOf(c.id, b.n, H.h); const st = stage(H.has);
        return h('button', { type: 'button', class: `cell ${st}${H.L ? ' L' : ''}`, title: H.ur, 'aria-pressed': sel && sid(sel) === sid(x) ? 'true' : 'false',
          'aria-label': `${code(x)}, ${STAGE_NAME[st]}${H.L ? ', class lesson L' + H.L : ''}${m ? ', ' + mText(m) : ''}`, onclick: () => pick(x) }, String(H.h), m ? h('i', { class: 'm ' + MK[m.status] }) : null);
      })), h('span', { class: 'sum', text: `${done} / ${b.hub.length}` })));
  }));
  const lg = (bg, t) => h('span', {}, h('i', { class: 'sw', style: bg }), t);
  v.append(h('section', { class: 'card', style: 'gap:16px' }, h('div', { class: 'ch', style: 'flex-wrap:wrap' }, h('h2', { style: 'font-size:20px;font-weight:700;letter-spacing:-.02em', text: 'Every hub sabaq' }),
    h('div', { class: 'legend' }, lg('background:var(--s-0)', 'in the hub'), lg('background:var(--s-1)', 'Teacher Copy'), lg('background:var(--s-2)', 'refined'), lg('background:var(--s)', 'class-ready'), lg('box-shadow:inset 0 0 0 2px var(--l)', 'class lesson (L)'))), rows));
  if (sel) { v.append(detail(sel)); if (S.scroll) { S.scroll = false; const d = $('#detail'); const r = d.getBoundingClientRect(); if (r.top > innerHeight - 120 || r.top < 0) d.scrollIntoView({ block: 'start' }); } }
}

// ---------- Map ----------
function renderMap(p) {
  const v = $('#view'); v.replaceChildren();
  const a = atlasOf(p.get('a') || 'mahdaviyat') || atlasOf('mahdaviyat');
  const feeds = {}; S.data.courses.forEach(c => c.babs.forEach(b => { feeds[c.atlas + ':' + b.from] = { c, b }; }));
  const first = a.babs.find(b => feeds[a.id + ':' + b.n] && feeds[a.id + ':' + b.n].b.hub.length);
  const bab = a.babs.find(b => b.n === +p.get('b')) || first || a.babs[0];
  const sel = findS(p.get('s'));
  v.append(h('header', { class: 'head' }, h('div', { style: 'display:flex;flex-direction:column;gap:4px' }, h('span', { class: 'date', text: 'Atlas, Bab, Fasl, then hub sabaq, then class lesson' }), h('h1', { text: 'Map' }))));
  const order = ['mahdaviyat', 'tauheed', 'akhlaq', 'adl', 'maad', 'nubuwat', 'imamat'];
  v.append(h('section', { class: 'atl', role: 'group', 'aria-label': 'Atlas' }, order.map(atlasOf).filter(Boolean).map(at => {
    const cs = S.data.courses.filter(c => c.atlas === at.id);
    return h('button', { type: 'button', class: 'acard', 'aria-pressed': at.id === a.id ? 'true' : 'false', onclick: () => go('map', { a: at.id }) },
      h('span', { class: 'ur', text: at.ur, lang: 'ur' }), h('span', { class: 'mt', text: at.state === 'done' ? `${at.babs.length} Babs${cs.length ? ', ' + cs.map(c => c.code).join(', ') : ''}` : 'being built' }),
      h('span', { class: 'dots' }, at.babs.map(b => { const fe = feeds[at.id + ':' + b.n]; let k = ''; if (fe) { const st = fe.b.hub.map(H => stage(H.has)); k = !fe.b.hub.length ? 'h' : st.some(s => s === 'ref' || s === 'cls') ? 'k' : st.some(s => s === 'tc') ? 't' : 'h'; } return h('i', { class: k, title: 'B' + b.n }); })));
  })));
  const list = h('div', { class: 'babs', role: 'group', 'aria-label': `${a.name} Babs` }, a.babs.map(b => {
    const st = b.fasls.map(f => f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).length ? 'o' : '').filter(Boolean);
    const n = st.length; const cnt = k => st.filter(x => x === k).length; const fe = feeds[a.id + ':' + b.n];
    return h('button', { type: 'button', class: 'bab', 'aria-pressed': b.n === bab.n ? 'true' : 'false', onclick: () => go('map', { a: a.id, b: b.n }) },
      h('span', { class: 'n', text: UD(b.n) }), h('span', { class: 'tt' }, ur(b.ur),
        h('span', { class: 'bar', style: n ? '' : 'background:transparent' }, n ? [['b', 'var(--f)'], ['w', 'var(--f-2)'], ['br', 'var(--f-stripe)']].map(([k, c]) => cnt(k) ? h('span', { style: `width:${100 * cnt(k) / n}%;background:${c}` }) : null) : null)),
      h('span', { class: 'hb', style: `color:${fe && fe.b.hub.some(H => H.L) ? 'var(--l-ink)' : 'var(--s)'}`, text: fe ? `${fe.c.code} B${fe.b.n}` : '' }));
  }));
  const fe = feeds[a.id + ':' + bab.n];
  const hi = new Set(sel && fe && sel.c.id === fe.c.id && sel.b.n === fe.b.n ? (sel.H.fasls || []).map(u => u.replace('U', '')) : []);
  const fst = bab.fasls.map(f => f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).length ? 'o' : 'n');
  const det = h('div', { style: 'display:flex;flex-direction:column;gap:14px;min-width:0' });
  det.append(h('section', { class: 'card' }, h('div', { class: 'bhead' },
    h('div', { style: 'display:flex;flex-direction:column' }, ur(`${a.ur}، باب ${UD(bab.n)}`, 's1'), ur(bab.ur, 'big')),
    h('div', { class: 'stats' }, h('span', { class: 'stat' }, h('b', { text: String(bab.fasls.length || 'not yet') }), h('span', { text: 'Fasls' })),
      fst.some(x => x !== 'n') ? h('span', { class: 'stat' }, h('b', { text: String(fst.filter(x => x === 'b').length) }), h('span', { text: 'atlas lessons built' })) : null,
      fe ? h('span', { class: 'stat' }, h('b', { text: String(fe.b.hub.length) }), h('span', { text: 'hub sabaq' })) : null,
      fe && fe.b.hub.some(H => H.L) ? h('span', { class: 'stat' }, h('b', { text: `${fe.b.hub.filter(H => H.L && H.Ls !== 'planned').length} + ${fe.b.hub.filter(H => H.L && H.Ls === 'planned').length}` }), h('span', { text: 'L taught + planned' })) : null)),
    bab.note ? h('p', { class: 'note', text: bab.note }) : null));
  const fcol = h('div', { class: 'col f' }, h('div', { class: 'chd' }, h('span', { class: 'ur', text: 'فصل', lang: 'ur' }), h('span', { class: 'k', text: 'Atlas, F' })));
  if (bab.fasls.length) bab.fasls.forEach((f, i) => { const s = fst[i]; const lbl = { b: 'built', w: 'written', br: 'branch', o: 'not started', n: 'not M1' }[s];
    fcol.append(h('div', { class: 'fr' + (hi.has(f.id) ? ' hi' : '') }, h('span', { class: 'c', text: 'F' + f.id.split('.')[1] }), ur(f.ur), h('span', { class: 'fs ' + s, text: lbl }))); });
  else fcol.append(h('p', { class: 'empty', text: a.state === 'done' ? 'No Fasls listed.' : 'Fasls are still being found by the atlas run.' }));
  const scol = h('div', { class: 'col s' }, h('div', { class: 'chd' }, h('span', { class: 'ur', text: 'سبق', lang: 'ur' }), h('span', { class: 'k', text: fe ? `Hub, ${fe.c.code} B${fe.b.n}, S` : 'Hub' })));
  const W = { plan: 4, tc: 33, ref: 66, cls: 100 }, C = { plan: 'var(--s-0)', tc: 'var(--s-1)', ref: 'var(--s-2)', cls: 'var(--s)' };
  if (fe && fe.b.hub.length) fe.b.hub.forEach(H => { const x = { c: fe.c, b: fe.b, H }; const st = stage(H.has); const m = mentorOf(fe.c.id, fe.b.n, H.h);
    scol.append(h('button', { type: 'button', class: 'sc' + (H.L ? ' L' : ''), 'aria-pressed': sel && sid(sel) === sid(x) ? 'true' : 'false', onclick: () => { S.scroll = true; go('map', { a: a.id, b: bab.n, s: sid(x) }); } },
      h('span', { class: 'r1' }, ur('سبق ' + UD(H.h)), h('span', { class: 'from', text: (H.fasls || []).map(u => 'F' + u.split('.')[1]).join(', ') })),
      ur(H.ur, 't'), h('span', { class: 'pb' }, h('i', { style: `width:${W[st]}%;background:${C[st]}` })),
      m ? h('span', { class: 'tag ' + MK[m.status], style: 'align-self:flex-start', text: mText(m) }) : null)); });
  else scol.append(h('p', { class: 'empty', text: fe ? `${fe.c.code} B${fe.b.n}: ${fe.b.hub_state}.` : 'This Bab has not been made into a hub yet.' }));
  const lcol = h('div', { class: 'col l' }, h('div', { class: 'chd' }, h('span', { class: 'ur', text: 'درس', lang: 'ur' }), h('span', { class: 'k', text: fe ? `Class, ${fe.c.code} B${fe.b.n}, L` : 'Class' })));
  const ls = fe ? fe.b.hub.filter(H => H.L).sort((p1, p2) => p1.L - p2.L) : []; const nextL = ls.find(H => H.Ls === 'planned');
  if (ls.length) ls.forEach(H => lcol.append(h('div', { class: 'lc' + (H.Ls === 'planned' ? (H === nextL ? ' next' : ' planned') : '') },
    h('span', { class: 'r1' }, h('span', { text: H.Ls === 'planned' ? (H === nextL ? 'next' : 'planned') : 'taught' }), h('b', {}, 'L' + H.L + ' ', h('small', { text: 'from S' + H.h }))), ur(H.ur))));
  else lcol.append(h('p', { class: 'empty', text: 'No class lesson is picked from this Bab yet.' }));
  det.append(h('div', { class: 'cols' }, fcol, scol, lcol));
  if (sel && fe && sel.c.id === fe.c.id && sel.b.n === fe.b.n) det.append(detail(sel));
  v.append(h('section', { class: 'mgrid' }, list, det));
  if (S.scroll && $('#detail')) { S.scroll = false; const d = $('#detail'); const r = d.getBoundingClientRect(); if (r.top > innerHeight - 120) d.scrollIntoView({ block: 'center' }); }

  const m = S.data.muqaddima, z = S.data.tazzakur;
  v.append(h('section', { class: 'card' }, h('div', { class: 'ch' }, h('h2', { style: 'font-size:20px;font-weight:700', text: 'Muqaddima' }), ur(m.ur)),
    h('p', { class: 'small muted', text: 'Written from its own source book, Maarif Zamina, not from an atlas.' }),
    h('div', { class: 'scroll' }, h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Lesson' }), h('th', { text: 'Title' }), h('th', { text: 'What it has' })),
      m.lessons.map(l => h('tr', {}, h('td', { class: 'code', text: l.code }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: l.ur }), h('td', {}, chipsOf(l.has))))))));
  v.append(h('section', { class: 'card' }, h('div', { class: 'ch' }, h('h2', { style: 'font-size:20px;font-weight:700', text: 'Tazzakur, class LMM-01' })),
    h('div', { class: 'scroll' }, h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Session' }), h('th', { text: 'Date' }), h('th', { text: 'Starts from' }), h('th', { text: 'Anchor' }), h('th', { text: 'State' })),
      z.sessions.map(s => h('tr', {}, h('td', { class: 'code', text: s.code }), h('td', { text: s.date }), h('td', { text: s.kind }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: s.ur }), h('td', { text: s.state })))))));
}

// ---------- mentor marks ----------
let saving = false;
async function saveMentor(x, entry) {
  if (saving) return; saving = true;
  const cid = x.c.id, key = unitKey(x.b.n, x.H.h);
  document.querySelectorAll('#detail .btn').forEach(b => { b.disabled = true; });
  const apply = board => { board.workmap = board.workmap || {}; board.workmap[cid] = board.workmap[cid] || {}; if (entry) board.workmap[cid][key] = entry; else delete board.workmap[cid][key]; return board; };
  const put = (board, sha) => gh('board.json', { method: 'PUT', headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Work Map: ${cid} ${key} ${entry ? entry.status : 'cleared'}`, content: b64enc(JSON.stringify(board, null, 1) + '\n'), sha, branch: 'main' }) });
  try {
    let res;
    try { res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    catch (e) { if (e.status !== 409 && e.status !== 422) throw e; const fresh = await readJson('board.json'); S.board = fresh.data; S.boardSha = fresh.sha; res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    apply(S.board); S.boardSha = res.content.sha;
    toast(entry ? `Saved. ${code(x)} is ${mText(entry)}.` : `Cleared the mark on ${code(x)}.`);
    route();
  } catch (e) {
    toast(e.status === 403 || e.status === 404 ? 'Not saved. The key can read but not write: give it Contents, read and write.' : 'Not saved. ' + (e.message || e));
    document.querySelectorAll('#detail .btn').forEach(b => { b.disabled = false; });
  } finally { saving = false; }
}

if (getKey()) load(); else connect();
})();
