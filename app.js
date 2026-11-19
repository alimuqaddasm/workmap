/* Maarif Work Map (v5 design). Reads workmap.json from the private repo hub-data and the mentor marks from hub-notes,
   with the viewer's own GitHub key (kept in this browser only; it covers hub-data and hub-notes, never the hub).
   The mentor buttons write hub-notes/marks.json.
   Place in the page lives in the address: #week?c=zm&s=zm-1-8, #course?c=zm&b=1&s=zm-1-8, #atlas?a=mahdaviyat&b=15. */
(function () {
'use strict';
const OWNER = 'alimuqaddasm', HUB = 'hub', KEY = 'workmap.key';
const API = repo => `https://api.github.com/repos/${OWNER}/${repo}/contents/`;
const DATA = 'hub-data', NOTES = 'hub-notes';
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
async function gh(path, opts, repo, raw) {
  let r;
  try { r = await fetch(API(repo || NOTES) + path, Object.assign({ headers: { Authorization: 'Bearer ' + getKey(), Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-cache' }, opts || {})); }
  catch (e) { const er = new Error('GitHub could not be reached. Check your connection.'); er.status = 0; throw er; }
  if (!r.ok) { const e = new Error(r.status === 401 ? 'GitHub refused the key. It may have expired or been revoked.' : r.status === 404 ? `This key cannot see ${path}. It needs the hub-data and hub-notes repos.` : `GitHub answered ${r.status}.`); e.status = r.status; throw e; }
  return raw ? r.text() : r.json();
}
async function readJson(path) { const j = await gh(path, null, NOTES); return { sha: j.sha, data: JSON.parse(b64dec(j.content)) }; }
async function readData(path) { return JSON.parse(await gh(path, null, DATA, true)); }

// ---------- data helpers ----------
const S = { data: null, board: null, boardSha: null, reading: null, ex44: null, ex44at: 0 };
// Reading Mode (the reading-mode site): full lesson text, read with this same key
const RM = 'https://alimuqaddasm.github.io/reading-mode/';
function readSabaq(cid, b, n) { const c = S.reading && S.reading.courses.find(x => x.id === cid); const bb = c && c.babs.find(x => x.n === b); const s = bb && bb.sabaq.find(x => x.n === n); return s ? { url: `${RM}#${cid}/${b}/${n}`, s } : null; }
function readClass(cid, b, L) { const c = S.reading && S.reading.courses.find(x => x.id === cid); const bb = c && c.babs.find(x => x.n === b); const ls = bb ? (bb.lessons || []).filter(x => x.L === L) : []; const l = ls.find(x => !x.variant && !/-a$/.test(x.slug)) || ls[0]; return l ? `${RM}#${cid}/${b}/${l.slug}` : null; }
function readMrf(code) { const c = S.reading && S.reading.courses.find(x => x.id === 'mrf'); const s = c && c.babs.flatMap(b => b.sabaq).find(x => x.slug === code); return s ? `${RM}#mrf/1/${s.slug}` : null; }
function readTaz(code) { const c = S.reading && S.reading.courses.find(x => x.id === 'taz'); const p = c && c.papers.find(x => x.path === `sessions/${code}.md`); return p ? `${RM}#taz/papers/${p.i}` : null; }
function readFasl(aid, b, fid) { const a = S.reading && S.reading.atlases.find(x => x.id === aid); const bb = a && a.babs.find(x => x.n === b); const u = /^U/.test(fid) ? fid : 'U' + fid; const f = bb && bb.fasls.find(x => x.id === u); return f && f.parts.length ? `${RM}#${aid}/${b}/${f.parts[0].id}` : null; }
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
function parse() { const [v, q] = location.hash.slice(1).split('?'); return { view: v === 'map' ? 'atlas' : ['atlas', 'course', 'ex44'].includes(v) ? v : 'week', p: new URLSearchParams(q || '') }; }
function go(view, params) { const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); }); const next = '#' + view + (q.toString() ? '?' + q : ''); if (location.hash === next) route(); else location.hash = next; }
function route() { if (!S.data) return; const { view, p } = parse(); side(view, p); if (view === 'ex44') renderEx44(); else if (view === 'atlas') renderAtlas(p); else if (view === 'course') renderCourse(p); else renderWeek(p); screen('app'); }
window.addEventListener('hashchange', route);

// ---------- load ----------
async function load() {
  screen('loading');
  try {
    const [w, b] = await Promise.all([readData('workmap.json'), readJson('marks.json')]);
    S.data = w; S.board = { workmap: b.data || {} }; S.boardSha = b.sha;
    try { S.reading = await readData('reading/index.json'); } catch (e) { S.reading = null; }
    route();
  } catch (e) {
    if (e.status === 401 || e.status === 404) { setKey(''); connect(e.status === 404 ? 'This key cannot open hub-data and hub-notes. Make a key for those two repos (steps above) and paste it here.' : e.message); return; }
    $('#failmsg').textContent = e.message || String(e); screen('fail');
  }
}
function connect(msg) { screen('connect'); $('#keyerr').hidden = !msg; $('#keyerr').textContent = msg || ''; }
$('#keyform').addEventListener('submit', e => { e.preventDefault(); const v = $('#key').value.trim(); if (!v) { connect('Paste a key first.'); return; } setKey(v); $('#key').value = ''; load(); });
$('#retry').addEventListener('click', load);
$('#rekey').addEventListener('click', () => { setKey(''); connect(); });

// ---------- top bar ----------
function side(view) {
  const el = $('#side'); el.replaceChildren();
  el.append(h('a', { class: 'brand', href: '#week' }, h('span', { class: 'mk' }, icon(16, 16, 'M2 11 L6 6 L9 9 L14 3', '2')), 'Work Map'),
    h('nav', { class: 'tabs', 'aria-label': 'Views' },
      h('a', { href: '#week', 'aria-current': view === 'week' ? 'page' : null, text: 'This week' }),
      h('a', { href: '#course', 'aria-current': view === 'course' ? 'page' : null, text: 'Courses' }),
      h('a', { href: '#atlas', 'aria-current': view === 'atlas' ? 'page' : null, text: 'Atlases' }),
      h('a', { href: '#ex44', 'aria-current': view === 'ex44' ? 'page' : null, text: 'EX-44' })),
    h('span', { class: 'upd' }, h('span', { text: 'Updated ' + fmtWhen(S.data.made) }),
      h('button', { type: 'button', class: 'linkbtn', onclick: () => { setKey(''); S.data = null; connect('Your key was removed from this browser.'); }, text: 'Forget my key' })));
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtWhen(t) { const m = /(\d{4})-(\d\d)-(\d\d)[ T](\d\d:\d\d)/.exec(t || ''); return m ? `${+m[3]} ${MON[+m[2] - 1]}, ${m[4]}` : (t || ''); }
function fmtDay(t) { const m = /(\d{4})-(\d\d)-(\d\d)/.exec(t || ''); return m ? `${+m[3]} ${MON[+m[2] - 1]}` : t; }
const hubState = s => (s || '').replace(/(\d{4})-(\d\d)-(\d\d)/, (x) => fmtDay(x));

// ---------- EX-44 (the working machine): every project and chat, what it is doing, what needs you ----------
// Data: hub-notes/ex44.json, written every 10 minutes by ex44-system/tools/status.py (reads each chat's screen).
// Filters live in the address: #ex44?s=asks&a=aw&q=b3&g=account&old=1&done=1
const ACT = {
  working: { t: 'working', d: 'Working now' },
  asks: { t: 'asks you', d: 'Finished and waiting for your answer' },
  login: { t: 'needs login', d: 'Sitting at the login screen' },
  error: { t: 'error', d: 'Stopped on an error' },
  limit: { t: 'at limit', d: 'Stopped by a usage limit' },
  idle: { t: 'idle', d: 'Finished, nothing asked' },
  stopped: { t: 'stopped', d: 'Chat closed or not found' },
  waiting: { t: 'parked', d: 'Job parked, waiting' },
  done: { t: 'done', d: 'Job finished' },
  unknown: { t: 'unknown', d: 'Screen could not be read' }
};
const ACT_ORDER = ['asks', 'login', 'error', 'working', 'limit', 'idle', 'waiting', 'stopped', 'done', 'unknown'];
const NEEDS = new Set(['asks', 'login', 'error']);
const few = (ns, n) => ns.length <= (n || 8) ? ns.join(', ') : ns.slice(0, n || 8).join(', ') + ` and ${ns.length - (n || 8)} more`;
const EXF = [['all', 'All'], ['needs', 'Needs you'], ['working', 'Working'], ['asks', 'Asks you'], ['limit', 'At limit'], ['idle', 'Idle'], ['stopped', 'Stopped']];
const ACCTS = ['amm', 'sc21', 'wk', 'aw'];
const EXO = 'ex44.open';
const exOpen = (() => { try { return new Set(JSON.parse(localStorage.getItem(EXO) || '[]')); } catch (e) { return new Set(); } })();
const exSave = () => { try { localStorage.setItem(EXO, JSON.stringify([...exOpen].slice(-200))); } catch (e) {} };
const actOf = j => j.state === 'done' ? 'done' : j.screen ? (j.screen.activity || 'unknown') : j.state === 'waiting' ? 'waiting' : 'stopped';
const baseOf = n => n.replace(/-was-\w+$/, '');
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const isLead = j => /(^|-)hub(-planning)?$|hub-planning/.test(baseOf(j.name));
function ago(t, now) {
  const ms = now - Date.parse(t); if (!(ms >= 0)) return '';
  const m = Math.round(ms / 60000); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago';
  const hh = Math.round(m / 60); if (hh < 36) return hh + ' h ago'; return Math.round(hh / 24) + ' days ago';
}
const localTime = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
function exGo(patch) {
  const { p } = parse(); const q = {}; for (const [k, v] of p) q[k] = v; Object.assign(q, patch);
  Object.keys(q).forEach(k => { if (q[k] == null || q[k] === '' || q[k] === 'all' || q[k] === '0') delete q[k]; });
  go('ex44', q);
}
async function exData(force) {
  if (!force && S.ex44 && Date.now() - S.ex44at < 120000) return S.ex44;
  S.ex44 = (await readJson('ex44.json')).data; S.ex44at = Date.now(); return S.ex44;
}
// auto refresh while the tab is open and visible
setInterval(() => { if (document.visibilityState === 'visible' && parse().view === 'ex44' && S.ex44 && Date.now() - S.ex44at > 120000) exData(true).then(() => { if (parse().view === 'ex44') renderEx44(true); }).catch(() => {}); }, 30000);

function exDot(act, title) { return h('span', { class: 'xdot x-' + act, title: title || ACT[act].d }); }
function exTag(act) { return h('span', { class: 'xtag x-' + act, text: ACT[act].t }); }

async function renderEx44(keepScroll) {
  const v = $('#view'); const y = window.scrollY;
  if (!S.ex44) v.replaceChildren(h('header', { class: 'head' }, h('h1', { text: 'EX-44' }), h('p', { class: 'lede', text: 'Loading the machine’s report.' })));
  let d; try { d = await exData(); } catch (e) { v.replaceChildren(h('header', { class: 'head' }, h('h1', { text: 'EX-44' }), h('p', { class: 'lede', text: 'No report from EX-44 could be read: ' + (e.message || e) }))); return; }
  if (parse().view !== 'ex44') return;
  const { p } = parse();
  const F = { s: p.get('s') || 'all', a: p.get('a') || 'all', q: (p.get('q') || '').toLowerCase(), g: p.get('g') || 'project', old: p.get('old') === '1', done: p.get('done') === '1' };
  const now = Date.parse(d.measured) || Date.now();
  const all = (d.jobs || []).map(j => Object.assign({}, j, { act: actOf(j), project: j.project || 'Other' }));
  const names = new Set(all.filter(j => j.state !== 'done').map(j => j.name));
  all.forEach(j => { j.copyOf = j.name !== baseOf(j.name) && names.has(baseOf(j.name)) ? baseOf(j.name) : null; });
  const live = all.filter(j => j.state !== 'done');
  // what the filters keep
  const passSt = (j, s) => s === 'all' ? true : s === 'needs' ? NEEDS.has(j.act) || !!(j.screen && j.screen.unsent) : s === 'stopped' ? ['stopped', 'waiting', 'unknown'].includes(j.act) : j.act === s;
  const passS = j => passSt(j, F.s);
  const passA = j => F.a === 'all' || j.account === F.a;
  const passQ = j => !F.q || [j.name, j.project, j.repo, j.brief, j.note, j.screen && j.screen.said, (j.waiting || []).join(' ')].some(x => (x || '').toLowerCase().includes(F.q));
  const pool = all.filter(j => (F.done || j.state !== 'done') && (F.old || !j.copyOf || F.q || F.s !== 'all'));
  const shown = pool.filter(j => passS(j) && passA(j) && passQ(j));
  const cnt = (list, f) => list.filter(f).length;

  // ---- header: one line saying the state of things ----
  const nNeeds = cnt(live, j => NEEDS.has(j.act)), nWork = cnt(live, j => j.act === 'working'), nLim = cnt(live, j => j.act === 'limit');
  const age = Math.round((Date.now() - Date.parse(d.measured)) / 60000);
  const head = h('header', { class: 'head row' },
    h('div', { class: 'head' }, h('h1', { text: 'EX-44' }),
      h('p', { class: 'lede' }, `${live.length} chats in ${new Set(live.map(j => j.project)).size} projects. `,
        h('span', { class: age > 30 ? 'err' : '', text: `Report from ${localTime(d.measured)}, ${ago(d.measured, Date.now())}` + (age > 30 ? ': the machine may be off or its timer stopped.' : '.') }), ' ',
        h('button', { type: 'button', class: 'linkbtn', text: 'Refresh', onclick: () => exData(true).then(() => renderEx44(true)).catch(e => toast(e.message)) }))),
    h('div', { class: 'totals xtot' },
      [['needs', nNeeds, 'need you'], ['working', nWork, 'working'], ['limit', nLim, 'at a limit'], ['idle', cnt(live, j => j.act === 'idle'), 'idle']].map(([k, n, t]) =>
        h('button', { type: 'button', class: 'xt' + (F.s === k ? ' on' : ''), 'aria-pressed': F.s === k ? 'true' : 'false', onclick: () => exGo({ s: F.s === k ? 'all' : k }) },
          h('b', {}, exDot(k === 'needs' ? 'asks' : k), String(n)), h('span', { text: t })))));

  // ---- filter bar ----
  const search = h('input', { type: 'search', class: 'xq', placeholder: 'Search chats, projects, what they said  ( / )', value: p.get('q') || '', 'aria-label': 'Search' });
  let tq; search.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(() => { exGo.typing = true; exGo({ q: search.value.trim() }); }, 250); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; exGo({ q: '' }); } });
  const chip = (on, label, n, onclick, cls) => h('button', { type: 'button', class: 'xc' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), 'aria-pressed': on ? 'true' : 'false', onclick }, label, n == null ? null : h('span', { class: 'n', text: String(n) }));
  const base = pool.filter(j => passA(j) && passQ(j)), baseS = pool.filter(j => passS(j) && passQ(j));
  const bar = h('div', { class: 'xbar' },
    h('div', { class: 'xrow' }, search,
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Group by' }, [['project', 'By project'], ['account', 'By account'], ['flat', 'One list']].map(([k, t]) =>
        h('a', { href: '#', 'aria-current': F.g === k ? 'true' : null, text: t, onclick: e => { e.preventDefault(); exGo({ g: k === 'project' ? '' : k }); } })))),
    h('div', { class: 'xrow' }, h('span', { class: 'xl', text: 'State' }),
      EXF.map(([k, t]) => chip(F.s === k, k === 'all' ? t : [exDot(k === 'needs' ? 'asks' : k), t], k === 'all' ? base.length : cnt(base, j => passSt(j, k)), () => exGo({ s: k })))),
    h('div', { class: 'xrow' }, h('span', { class: 'xl', text: 'Account' }),
      [['all', 'All']].concat(ACCTS.map(a => [a, a])).map(([k, t]) => chip(F.a === k, t, k === 'all' ? baseS.length : cnt(baseS, j => j.account === k), () => exGo({ a: k }))),
      h('span', { class: 'xsp' }),
      chip(F.old, 'Earlier copies', cnt(live, j => j.copyOf), () => exGo({ old: F.old ? '' : '1' }), 'opt'),
      chip(F.done, 'Finished jobs', cnt(all, j => j.state === 'done'), () => exGo({ done: F.done ? '' : '1' }), 'opt')));

  // ---- needs you ----
  const need = [], nl = live.filter(j => passA(j) && passQ(j)), narrowN = F.a !== 'all' || !!F.q;
  (narrowN ? [] : (d.alerts || [])).filter(a => a.status === 'pending').forEach(a => need.push(['asks', h('b', { text: `Alert ${a.id}: approve a move?` }), a.text + ' Answer “yes ' + a.id + '” or “no ' + a.id + '” in any launch chat.']));
  nl.filter(j => j.screen && j.screen.unsent).forEach(j => need.push(['asks', exLink(j, 'Unsent message in '), '“' + j.screen.unsent + '”. You typed this but never pressed Enter.']));
  const logins = nl.filter(j => j.act === 'login'); if (logins.length) need.push(['login', h('b', { text: `${logins.length} chat${logins.length > 1 ? 's' : ''} at the login screen` }), logins.map(j => j.name).join(', ') + '. Press Enter in each, or close it.']);
  const twins = nl.filter(j => j.copyOf && j.act !== 'limit' && j.act !== 'stopped' && (all.find(x => x.name === j.copyOf) || {}).act !== 'stopped');
  if (twins.length) need.push(['idle', h('b', { text: `${twins.length} earlier copies still open next to their new chat` }), twins.map(j => j.name).join(', ') + '. Closing them frees memory and avoids two chats on one job.']);
  const lim = {}; nl.filter(j => j.act === 'limit').forEach(j => { const k = j.account + '|' + ((j.screen && j.screen.resets) || ''); (lim[k] = lim[k] || []).push(j.name); });
  Object.entries(lim).forEach(([k, ns]) => { const [a, r] = k.split('|'); need.push(['limit', h('b', { text: `${ns.length} chat${ns.length > 1 ? 's' : ''} on ${a} stopped by a limit` + (r ? `, resets ${r}` : '') }), few(ns)]); });
  const w = d.waiting_for_ali || {}; const wn = (w.drive || 0) + (w.both_sides || 0);
  if (wn && !narrowN) need.push(['asks', h('b', { text: `${wn} file${wn > 1 ? 's' : ''} waiting for your decision` }), `${w.drive || 0} changed on Drive by others, ${w.both_sides || 0} changed on both la57 and EX-44.`]);
  if (d.unsent_on_la57 && !narrowN) need.push(['idle', h('b', { text: `${d.unsent_on_la57} files changed on la57, not sent back yet` }), 'They come back with la57’s next send-back.']);
  const asks = nl.filter(j => j.act === 'asks');
  const needSec = sec(h('h2', {}, 'Needs you' + (F.a !== 'all' ? ` on ${F.a} ` : ' '), h('span', { class: 'muted small', text: `${asks.length} chats asking, plus ${need.length} other item${need.length === 1 ? '' : 's'}` })), null,
    h('div', { class: 'panel' }, need.length ? h('ul', { class: 'needs xneeds' }, need.map(([k, t, s]) => h('li', {}, exDot(k), h('span', {}, t, h('span', { text: s }))))) : h('p', { class: 'empty', text: 'Nothing beyond the chats asking you below.' }),
      asks.length ? h('p', { class: 'small' }, h('a', { href: '#ex44?s=asks', onclick: e => { e.preventDefault(); exGo({ s: 'asks' }); }, text: `Show the ${asks.length} chats that asked you something` })) : null));

  // ---- groups ----
  const groupKey = F.g === 'account' ? (j => j.account || '?') : F.g === 'flat' ? (() => 'All chats') : (j => j.project);
  const groups = {}; shown.forEach(j => { (groups[groupKey(j)] = groups[groupKey(j)] || []).push(j); });
  const totalsBy = {}; pool.forEach(j => { (totalsBy[groupKey(j)] = totalsBy[groupKey(j)] || []).push(j); });
  const gnames = Object.keys(groups).sort((a, b) => (a === 'Other') - (b === 'Other') || (a === 'Account homes') - (b === 'Account homes') || natural(a, b));
  const narrowed = F.s !== 'all' || F.a !== 'all' || F.q;
  const list = h('div', { class: 'xgroups' }, gnames.length ? gnames.map(g => exGroup(g, groups[g], totalsBy[g] || groups[g], F, now, narrowed || F.g === 'flat')) : h('div', { class: 'panel' }, h('p', { class: 'empty', text: 'No chat matches these filters.' }),
    h('p', {}, h('button', { type: 'button', class: 'btn', text: 'Clear filters', onclick: () => go('ex44', {}) }))));
  const listSec = sec(h('h2', {}, F.g === 'account' ? 'Accounts and their chats ' : F.g === 'flat' ? 'Chats ' : 'Projects and their chats ', h('span', { class: 'muted small', text: `${shown.length} shown` })),
    gnames.length > 1 ? h('span', { class: 'mbtns' }, h('button', { type: 'button', class: 'linkbtn', text: 'Open all', onclick: () => { gnames.forEach(g => exOpen.add('g:' + g)); exSave(); renderEx44(true); } }),
      h('button', { type: 'button', class: 'linkbtn', text: 'Close all', onclick: () => { gnames.forEach(g => exOpen.delete('g:' + g)); exSave(); renderEx44(true); } })) : null, list);

  // ---- accounts and machine ----
  const accSec = sec('Accounts', null, h('div', { class: 'xacc' }, (d.accounts || []).map(a => {
    const js = live.filter(j => j.account === a.tag); const k = {}; js.forEach(j => { k[j.act] = (k[j.act] || 0) + 1; });
    const rs = [...new Set(js.filter(j => j.act === 'limit').map(j => j.screen.resets).filter(Boolean))];
    return h('button', { type: 'button', class: 'panel xa' + (F.a === a.tag ? ' on' : ''), onclick: () => exGo({ a: F.a === a.tag ? 'all' : a.tag }) },
      h('span', { class: 'ph' }, h('b', { class: 'code', text: a.tag }), h('span', { class: a.logged_in ? 'tag fin' : 'tag rev', text: a.logged_in ? (a.plan || 'logged in') : 'logged out' })),
      h('span', { class: 'xstrip' }, js.slice().sort((x, y) => ACT_ORDER.indexOf(x.act) - ACT_ORDER.indexOf(y.act)).map(j => exDot(j.act, j.name + ': ' + ACT[j.act].d))),
      h('span', { class: 'small muted', text: `${js.length} chats: ` + ACT_ORDER.filter(x => k[x]).map(x => `${k[x]} ${ACT[x].t}`).join(', ') }),
      rs.length ? h('span', { class: 'small', text: 'Limit resets ' + rs.join('; ') }) : null);
  })));
  const foot = h('p', { class: 'muted small', text: `Model for new chats: ${d.model_default || '?'}. Index service: ${d.index_service || '?'}. Disk free: about ${d.disk_free_gb} GB.` + (d.to_publish == null ? '' : ` Waiting to publish to la57: ${d.to_publish}.`) });
  const legendRow = h('p', { class: 'xleg' }, ACT_ORDER.filter(k => k !== 'unknown').map(k => h('span', {}, exDot(k), ACT[k].t)));

  v.replaceChildren(head, bar, needSec, listSec, accSec, legendRow, foot);
  if (keepScroll) window.scrollTo(0, y);
  document.onkeydown = e => { if (e.key === '/' && parse().view === 'ex44' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); search.focus(); } };
  if (exGo.typing) { exGo.typing = false; search.focus(); const n = search.value.length; search.setSelectionRange(n, n); }
}
function exLink(j, pre) { return h('b', {}, pre || '', h('a', { href: '#ex44?q=' + encodeURIComponent(j.name), text: j.name })); }

function exGroup(g, js, tot, F, now, open) {
  const key = 'g:' + g; const isOpen = open || exOpen.has(key);
  const k = {}; tot.forEach(j => { k[j.act] = (k[j.act] || 0) + 1; });
  const latest = tot.map(j => j.screen && j.screen.changed).filter(Boolean).sort().pop();
  const repos = [...new Set(tot.map(j => j.repo).filter(r => r && r !== '-'))];
  // nest earlier copies under the chat that took over
  const byName = {}; js.forEach(j => { byName[j.name] = j; });
  const top = js.filter(j => !(j.copyOf && byName[j.copyOf])).sort((a, b) => isLead(b) - isLead(a) || natural(a.name, b.name));
  const det = h('details', { class: 'xg panel flush', open: isOpen ? true : null },
    h('summary', { class: 'xgs' },
      h('span', { class: 'xchev', 'aria-hidden': 'true' }, icon(10, 10, 'M3 1 L7 5 L3 9', '1.8')),
      h('span', { class: 'xgt' }, h('b', { text: g }), h('span', { class: 'small muted', text: `${tot.length} chat${tot.length === 1 ? '' : 's'}` + (repos.length && F.g !== 'project' ? '' : repos.length ? ' · repo ' + repos.join(', ') : '') })),
      h('span', { class: 'xstrip' }, tot.slice().sort((a, b) => ACT_ORDER.indexOf(a.act) - ACT_ORDER.indexOf(b.act)).map(j => exDot(j.act, j.name + ': ' + ACT[j.act].d))),
      h('span', { class: 'xgc small' }, ACT_ORDER.filter(x => k[x] && x !== 'idle' && x !== 'done').map(x => h('span', { class: 'xgn x-' + x, text: `${k[x]} ${ACT[x].t}` })), k.idle ? h('span', { class: 'muted', text: `${k.idle} idle` }) : null),
      h('span', { class: 'xga small muted', text: latest ? ago(latest, now) : '' })));
  det.addEventListener('toggle', () => { det.open ? exOpen.add(key) : exOpen.delete(key); exSave(); });
  const rows = h('div', { class: 'xchats' });
  top.forEach(j => { rows.append(exChat(j, now, false)); js.filter(c => c.copyOf === j.name).forEach(c => rows.append(exChat(c, now, true))); });
  det.append(rows);
  return det;
}

function exChat(j, now, nested) {
  const sc = j.screen || {}; const key = 'c:' + j.name;
  const said = sc.said || j.note || j.brief || '';
  const when = sc.changed ? ago(sc.changed, now) : j.changed ? ago(j.changed, now) : '';
  const det = h('details', { class: 'xc-row' + (nested ? ' nested' : ''), open: exOpen.has(key) ? true : null },
    h('summary', {},
      exDot(j.act),
      h('span', { class: 'xn' }, h('span', { class: 'code', text: j.name }),
        nested ? h('span', { class: 'xbadge', text: 'earlier copy' }) : null,
        isLead(j) ? h('span', { class: 'xbadge lead', text: 'lead' }) : null,
        h('span', { class: 'xacct', text: j.account || '' })),
      h('span', { class: 'xs' }, exTag(j.act),
        j.act === 'limit' && sc.resets ? h('span', { class: 'small muted', text: 'resets ' + sc.resets }) : null,
        sc.unsent ? h('span', { class: 'xbadge warn', text: 'unsent text' }) : null,
        sc.remote_off ? h('span', { class: 'xbadge', title: 'Remote Control was ended from another device', text: 'phone link off' }) : null),
      h('span', { class: 'xsaid' + (said === sc.said ? '' : ' muted'), text: said }),
      h('span', { class: 'xw small muted', text: when })));
  det.addEventListener('toggle', () => { det.open ? exOpen.add(key) : exOpen.delete(key); exSave(); });
  const kv = (k, v) => v ? h('div', { class: 'xkv' }, h('span', { class: 'dk', text: k }), typeof v === 'string' ? h('span', { text: v }) : v) : null;
  const ul = xs => xs && xs.length ? h('ul', { class: 'xul' }, xs.map(x => h('li', { text: x }))) : null;
  const attach = 'tmux attach -t ' + j.name;
  det.append(h('div', { class: 'xd' },
    h('div', { class: 'dcol' },
      kv('Last thing it said' + (sc.done_at ? ` (finished ${sc.done_at})` : ''), sc.said ? h('p', { class: 'xfull', text: sc.said }) : null),
      kv('Last message it got', sc.you_asked || null),
      kv('You typed but did not send', sc.unsent || null),
      kv('Waiting on you (job note)', ul(j.waiting)),
      kv('Next (job note)', ul(j.next)),
      !sc.said && (j.note || j.brief) ? kv('Note', j.note || j.brief) : null),
    h('div', { class: 'dcol xside' },
      kv('State', `${ACT[j.act].d}` + (sc.changed ? `. Screen last changed ${localTime(sc.changed)}` : '') + '.'),
      kv('Project', j.project + (j.repo && j.repo !== '-' ? ` (repo ${j.repo})` : '')),
      kv('Branch', j.branch && j.branch !== '-' ? j.branch : null),
      kv('Last commit', j.commit ? `${localTime(j.commit.when)}: ${j.commit.msg}` : null),
      kv('Memory used', sc.memory_k ? h('span', { class: 'xmem' }, h('i', {}, h('i', { style: `width:${Math.min(100, sc.memory_k / 10)}%` })), `${sc.memory_k}k tokens` + (sc.memory_k > 600 ? ': near full, a fresh chat would be faster' : '')) : null),
      kv('Helpers', sc.helpers || sc.shells ? `${sc.helpers || 0} subagents, ${sc.shells || 0} shells` : null),
      kv('Started', j.started ? (j.started.startsWith('before') ? j.started : localTime(j.started)) : null),
      kv('Model', j.model || null),
      h('div', { class: 'mbtns' }, h('button', { type: 'button', class: 'btn', text: 'Copy attach command', onclick: () => { navigator.clipboard.writeText(attach).then(() => toast('Copied: ' + attach), () => toast(attach)); } })))));
  return det;
}

// ---------- shared pieces ----------
const ST = ['cls', 'ref', 'tc', 'plan'];
const ST_WORD = { cls: 'class-ready', ref: 'refined', tc: 'written', plan: 'listed only' };
function tally(hubs) { const k = { cls: 0, ref: 0, tc: 0, plan: 0 }; hubs.forEach(H => k[stage(H.has)]++); return k; }
function stageBar(k, cls) {
  const tot = ST.reduce((n, s) => n + k[s], 0);
  return h('span', { class: 'sbar' + (cls ? ' ' + cls : '') + (tot ? '' : ' empty'), 'aria-hidden': 'true' }, tot ? ST.map(s => k[s] ? h('span', { class: 'st-' + s, style: `width:${100 * k[s] / tot}%` }) : null) : null);
}
function stageText(k) { const tot = ST.reduce((n, s) => n + k[s], 0); return tot ? `${tot} sabaq: ` + ST.filter(s => k[s]).map(s => `${k[s]} ${ST_WORD[s]}`).join(', ') : 'Hub sabaq not drafted yet'; }
function legend(items) { return h('span', { class: 'legend' }, items.map(([c, t]) => h('span', {}, h('i', { class: c }), t))); }
const stageLegend = () => legend([['st-cls', 'Class-ready'], ['st-ref', 'Refined'], ['st-tc', 'Teacher Copy written'], ['st-plan', 'Listed only']]);
const sec = (title, right, ...kids) => h('section', { class: 'sec' }, h('div', { class: 'sh' }, typeof title === 'string' ? h('h2', { text: title }) : title, right || null), kids);
const nextLabel = x => `${x.c.code} B${x.b.n} L${x.H.L}`;
const OTHERS = [['mrf', 'معارف: مقدماتی گفتگو', 'Muqaddima'], ['taz', 'تذکر', 'Tazzakur']];
function courseSub(c) {
  const a = atlasOf(c.atlas); const fr = c.babs.map(b => b.from);
  const range = fr.length > 2 ? `B${fr[0]} to B${fr[fr.length - 1]}` : fr.map(n => 'B' + n).join(' and ');
  return `${c.code} · from ${a ? a.name : c.atlas} ${range} · ${c.babs.length} Bab${c.babs.length === 1 ? '' : 's'}`;
}
function lessonTotals(c) { const all = c.babs.flatMap(b => b.hub); return { taught: all.filter(H => H.L && H.Ls !== 'planned').length, planned: all.filter(H => H.L && H.Ls === 'planned').length }; }

// what a sabaq still needs before class
const READY = [['tc', 'Teacher Copy'], ['handout', 'Handout'], [['refined', 'proof'], 'Refined and proofed'], [['main', 'extra'], 'Main deck']];
const hasAny = (set, k) => (Array.isArray(k) ? k : [k]).some(x => set.has(x));

// ---------- This week ----------
function renderWeek() {
  const v = $('#view'); v.replaceChildren();
  const all = allS();
  const planned = all.filter(x => x.H.L && x.H.Ls === 'planned').sort((a, b) => a.c.id.localeCompare(b.c.id) || a.H.L - b.H.L);
  const needs = waiting(all, planned);
  const moving = S.data.courses.filter(c => c.babs.some(b => b.hub.length)).length;
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const say = [planned.length ? `${planned.length} class lesson${planned.length === 1 ? '' : 's'} planned` : 'No class lesson planned',
    needs.length ? `${needs.length} thing${needs.length === 1 ? '' : 's'} waiting on you` : 'nothing waiting on you', `${moving} course${moving === 1 ? '' : 's'} moving`];
  v.append(h('header', { class: 'head' }, h('h1', { text: date }), h('p', { class: 'lede', text: say.join(', ') + '.' })));

  const top = h('section', { class: 'two' });
  const nx = planned[0];
  if (nx) {
    const has = new Set(nx.H.has); const a = atlasOf(nx.c.atlas);
    top.append(h('article', { class: 'panel next' },
      h('div', { class: 'ph' }, h('h2', { text: 'Next class' }), h('span', { class: 'ltag', text: nextLabel(nx) })),
      h('div', { class: 'nt' }, ur(nx.H.ur, 'big', 'p'),
        h('span', { class: 'from', text: `from hub sabaq ${code(nx)}` + ((nx.H.fasls || []).length ? `, built on ${a.name} B${nx.b.from} ` + nx.H.fasls.map(u => 'F' + u.split('.')[1]).join(' and ') : '') })),
      h('div', { class: 'ready' }, h('span', { class: 'muted small', text: 'Ready for class when all four are done' }),
        h('div', { class: 'steps' }, READY.map(([k, n]) => { const ok = hasAny(has, k); return h('div', { class: 'step' + (ok ? ' ok' : '') }, h('i'), h('span', { text: (ok ? 'Done: ' : 'To do: ') + n })); }))),
      h('span', { style: 'display:flex;gap:16px;flex-wrap:wrap' }, h('a', { class: 'more', href: `#course?c=${nx.c.id}&b=${nx.b.n}&s=${sid(nx)}`, text: 'Open this sabaq' }),
        readSabaq(nx.c.id, nx.b.n, nx.H.h) ? h('a', { class: 'more', href: readSabaq(nx.c.id, nx.b.n, nx.H.h).url, target: 'rm', text: 'Read it in Reading Mode' }) : null),
      planned.length > 1 ? h('div', { class: 'after' }, h('span', { class: 'muted small', text: 'After that' }),
        planned.slice(1, 4).map(x => h('a', { class: 'arow', href: `#course?c=${x.c.id}&b=${x.b.n}&s=${sid(x)}` }, ur(x.H.ur), h('span', { class: 'lcode', text: `${nextLabel(x)} · from S${x.H.h}` })))) : null));
  } else top.append(h('article', { class: 'panel' }, h('h2', { text: 'Next class' }), h('p', { class: 'empty', text: 'No class lesson is planned. Ask Claude to "teach ZM B1 S12 as L6" and it shows here.' })));
  top.append(h('article', { class: 'panel' }, h('h2', { text: 'Waiting on you' }),
    needs.length ? h('ul', { class: 'needs' }, needs.map(n => h('li', {}, h('i'), h('span', {}, n.href ? h('a', { href: n.href, text: n.t }) : h('b', { text: n.t }), h('span', { text: n.d })))))
      : h('p', { class: 'empty', text: 'Nothing is waiting on you.' })));
  v.append(top);

  const tb = h('tbody');
  S.data.courses.forEach(c => {
    const k = tally(c.babs.flatMap(b => b.hub)); const L = lessonTotals(c);
    const nxc = planned.find(x => x.c.id === c.id);
    tb.append(h('tr', {},
      h('td', {}, h('a', { class: 'cname', href: '#course?c=' + c.id }, ur(c.ur, 'big'), h('span', { text: courseSub(c) }))),
      h('td', {}, stageBar(k), h('span', { class: 'cnt', text: stageText(k) })),
      h('td', {}, h('b', { class: 'lnum', text: L.taught ? `${L.taught} taught` : 'None yet' }),
        h('span', { class: 'cnt', text: L.planned ? `${L.planned} planned${nxc ? ', L' + nxc.H.L + ' next' : ''}` : 'no lesson planned' }))));
  });
  const others = h('div', { class: 'others' }, OTHERS.map(([id, n, en]) => h('a', { href: '#course?c=' + id }, ur(n), h('span', { text: id === 'mrf' ? `${en}, ${S.data.muqaddima.lessons.length} lessons, own source book` : `${en}, ${S.data.tazzakur.sessions.length} sessions, last on ${fmtDay((S.data.tazzakur.sessions.slice(-1)[0] || {}).date)}` }))));
  v.append(sec('Where each course stands', stageLegend(), h('div', { class: 'panel flush' }, h('div', { class: 'scroll' }, h('table', { class: 'ctable' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Course' }), h('th', { scope: 'col', text: 'Hub sabaq, by stage' }), h('th', { scope: 'col', text: 'Class lessons' }))), tb)), others)));

  const ch = S.data.changes || [];
  v.append(sec('Last 24 hours', null, ch.length ? h('ol', { class: 'changes' }, ch.slice(0, 8).map(c => h('li', {}, h('span', { class: 'muted', text: c.when.slice(11) }),
    h('b', { text: c.repo }), h('span', {}, c.ref === 'main' ? null : h('span', { class: 'brtag', text: 'branch' }), c.last)))) : h('p', { class: 'empty', text: 'No commits in the last 24 hours.' })));
}
function waiting(all, planned) {
  const o = [];
  all.forEach(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); if (m && m.status === 'revising') o.push({ t: `${code(x)}: mentor wants changes`, d: m.note || 'See the note on the sabaq.', href: `#course?c=${x.c.id}&b=${x.b.n}&s=${sid(x)}` }); });
  const groups = {};
  planned.filter(x => stage(x.H.has) !== 'cls').forEach(x => { const k = x.c.id + x.b.n; (groups[k] = groups[k] || []).push(x); });
  Object.values(groups).forEach(g => {
    const Ls = g.map(x => x.H.L); const lbl = Ls.length > 1 ? `L${Ls[0]} to L${Ls[Ls.length - 1]}` : `L${Ls[0]}`;
    o.push({ t: `${g[0].c.code} B${g[0].b.n} ${lbl}: decks not made`, d: `${g.length > 1 ? 'These planned class lessons are' : 'This planned class lesson is'} not class-ready yet. Refine, proof and build the deck${g.length > 1 ? 's' : ''} before class.`, href: `#course?c=${g[0].c.id}&b=${g[0].b.n}&f=class` });
  });
  S.data.courses.forEach(c => {
    const a = atlasOf(c.atlas);
    c.babs.forEach(b => { if (!b.hub.length) return; const k = tally(b.hub); if (k.plan) o.push({ t: `${c.code} B${b.n}: ${k.plan === b.hub.length ? `${k.plan} sabaq listed, none written` : `${k.plan} of ${b.hub.length} sabaq still to write`}`, d: `Hub ${hubState(b.hub_state)}, built on ${a.name} B${b.from}.`, href: `#course?c=${c.id}&b=${b.n}` }); });
    const none = c.babs.filter(b => !b.hub.length);
    if (none.length) o.push({ t: `${c.code} ${none.length > 1 ? `B${none[0].n} to B${none[none.length - 1].n}` : 'B' + none[0].n}: hub not drafted`, d: none.map(b => `B${b.n}: ${b.hub_state}`).join('. ') + '.', href: `#course?c=${c.id}&b=${none[0].n}` });
  });
  S.data.atlases.forEach(a => a.babs.forEach(b => { if (b.branch && (b.branch.counts.refined || 0) > 20) o.push({ t: `${a.name} B${b.n}: ${b.branch.counts.refined} Fasl lessons waiting for review`, d: 'Arabic checks and a decisions list, on a branch.', href: `#atlas?a=${a.id}&b=${b.n}` }); }));
  return o;
}

// ---------- Courses ----------
function courseTabs(cid) {
  return h('div', { class: 'ctabs', role: 'group', 'aria-label': 'Course' },
    S.data.courses.map(c => [c.id, c.ur, c.code]).concat(OTHERS).map(([id, n, k]) =>
      h('a', { href: '#course?c=' + id, 'aria-current': id === cid ? 'page' : null }, ur(n), h('span', { text: k }))));
}
function renderCourse(p) {
  const v = $('#view'); v.replaceChildren();
  const cid = p.get('c') || 'zm';
  v.append(courseTabs(cid));
  if (cid === 'mrf' || cid === 'taz') { renderOther(cid); return; }
  const c = courseOf(cid) || S.data.courses[0]; const a = atlasOf(c.atlas);
  const b = c.babs.find(x => x.n === +p.get('b')) || c.babs.find(x => x.hub.length) || c.babs[0];
  const ab = a.babs.find(x => x.n === b.from);
  const sel = findS(p.get('s')); const filt = p.get('f') || 'all';
  const allH = c.babs.flatMap(x => x.hub); const k = tally(allH); const L = lessonTotals(c);
  v.append(h('header', { class: 'head row' },
    h('div', {}, h('h1', {}, ur(c.ur, 'big', 'span')), h('p', { class: 'lede' }, `${courseSub(c)}. `, h('a', { href: '#atlas?a=' + a.id, text: 'Open the atlas' }))),
    h('div', { class: 'totals' }, [[allH.length, 'sabaq listed'], [allH.length - k.plan, 'Teacher Copy written'], [k.cls, 'class-ready'], [`${L.taught} + ${L.planned}`, 'taught + planned']]
      .map(([n, t]) => h('span', {}, h('b', { text: String(n) }), h('span', { text: t }))))));

  v.append(sec('Babs', stageLegend(), h('div', { class: 'panel list' }, c.babs.map(x => {
    const xab = a.babs.find(y => y.n === x.from); const xk = tally(x.hub); const Ls = x.hub.filter(H => H.L).map(H => H.L).sort((m, n) => m - n);
    return h('a', { class: 'babrow', href: `#course?c=${c.id}&b=${x.n}`, 'aria-current': x.n === b.n ? 'true' : null },
      h('span', { class: 'bn', text: 'B' + x.n }),
      h('span', { class: 'bt' }, ur(xab ? xab.ur : ''), h('span', { class: 'meta', text: `from ${a.name} B${x.from} · hub ${hubState(x.hub_state)}` })),
      h('span', { class: 'bp' }, stageBar(xk), h('span', { class: 'cnt', text: stageText(xk) })),
      h('span', { class: 'bl', text: Ls.length ? (Ls.length > 1 ? `L${Ls[0]} to L${Ls[Ls.length - 1]}` : 'L' + Ls[0]) : '' }));
  }))));

  const F = [['all', 'All', () => true], ['class', 'In class', H => H.L], ['ready', 'Class-ready', H => stage(H.has) === 'cls'], ['refine', 'Needs refining', H => stage(H.has) === 'tc'], ['write', 'Not written', H => stage(H.has) === 'plan']]
    .map(([id, t, fn]) => ({ id, t, fn, n: b.hub.filter(fn).length })).filter(f => f.id === 'all' || f.n);
  const cur = F.find(f => f.id === filt) || F[0];
  const title = h('h2', { class: 'bh' }, h('span', { text: `B${b.n} hub sabaq` }), ur(ab ? ab.ur : ''));
  const seg = F.length > 1 ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' }, F.map(f => h('a', { href: `#course?c=${c.id}&b=${b.n}` + (f.id === 'all' ? '' : '&f=' + f.id), 'aria-current': f === cur ? 'true' : null, text: `${f.t} ${f.n}` }))) : null;
  const rows = b.hub.filter(cur.fn);
  const body = h('div', { class: 'panel flush' });
  if (!b.hub.length) body.append(h('p', { class: 'empty pad', text: `No sabaq listed yet. Hub: ${hubState(b.hub_state)}.` }));
  else {
    body.append(h('div', { class: 'srow shd' }, h('span', { text: 'Sabaq' }), h('span', { class: 'r', text: 'Title, and the atlas Fasls it uses' }), h('span', { text: 'Written · Refined · Deck' }), h('span', { text: 'Class' })));
    rows.forEach(H => {
      const x = { c, b, H }; const st = stage(H.has); const lvl = { plan: 0, tc: 1, ref: 2, cls: 3 }[st]; const m = mentorOf(c.id, b.n, H.h);
      const open = sel && sid(sel) === sid(x);
      body.append(h('a', { class: 'srow', href: `#course?c=${c.id}&b=${b.n}` + (cur.id === 'all' ? '' : '&f=' + cur.id) + (open ? '' : '&s=' + sid(x)), 'aria-expanded': open ? 'true' : 'false', onclick: () => { S.scroll = !open; } },
        h('span', { class: 'sn', text: 'S' + H.h }),
        h('span', { class: 'stt' }, ur(H.ur), h('span', { class: 'meta', text: (H.fasls || []).length ? `${a.name} B${b.from} ` + H.fasls.map(u => 'F' + u.split('.')[1]).join(', ') : `${a.name} B${b.from}` })),
        h('span', { class: 'steps3', title: STAGE_NAME[st] }, [1, 2, 3].map(i => h('i', { class: i <= lvl ? 'on' + i : '' }))),
        h('span', { class: 'sc' }, H.L ? h('span', { class: 'ltag' + (sel && sel.H === H ? '' : '') + (H.Ls === 'planned' && H === nextOf(b) ? ' next' : ''), text: `L${H.L} ${H.Ls === 'planned' ? (H === nextOf(b) ? 'next' : 'planned') : 'taught'}` }) : null,
          m ? h('span', { class: 'tag ' + MK[m.status], text: mText(m) }) : null)));
      if (open) body.append(detail(x));
    });
    if (!rows.length) body.append(h('p', { class: 'empty pad', text: 'No sabaq in this group.' }));
  }
  v.append(sec(title, seg, body, ab ? h('p', { class: 'muted small', style: 'margin-top:10px' }, `The ${ab.fasls.length} Fasls of ${a.name} B${b.from}, and which sabaq uses each, are on the `, h('a', { href: `#atlas?a=${a.id}&b=${b.from}`, text: 'atlas page' }), '.') : null));
  if (S.scroll && $('#detail')) { S.scroll = false; const d = $('#detail'); const r = d.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) d.scrollIntoView({ block: 'nearest' }); }
}
const nextOf = b => b.hub.filter(H => H.L && H.Ls === 'planned').sort((m, n) => m.L - n.L)[0];

// the open sabaq: what it has, what is still to make, the chain, mentor buttons
function detail(x) {
  const a = atlasOf(x.c.atlas); const m = mentorOf(x.c.id, x.b.n, x.H.h); const has = new Set(x.H.has);
  const missing = READY.filter(([k]) => !hasAny(has, k)).map(([, n]) => n);
  const chain = h('div', { class: 'chain' });
  (x.H.fasls || []).forEach(u => { const f = fasl(a, u); const bn = +u.slice(1).split('.')[0]; const href = readFasl(a.id, bn, u); chain.append(h(href ? 'a' : 'div', { class: 'cf', href, target: href ? 'rm' : null, title: href ? 'Read this atlas lesson in Reading Mode' : null }, h('span', { class: 'k', text: fcode(a, u) }), ur(f ? f.ur : ''))); });
  const note = h('input', { id: 'mnote', type: 'text', placeholder: 'What the mentor asked for', value: m && m.note ? m.note : '' });
  const set = st => { const prev = mentorOf(x.c.id, x.b.n, x.H.h); const round = st === 'revising' ? ((prev && prev.round) || 0) + 1 : (prev && prev.round) || 0;
    saveMentor(x, st ? { status: st, round, note: note.value.trim(), updated: new Date().toISOString().slice(0, 16) } : null); };
  const btn = (cls, st, label) => h('button', { type: 'button', class: 'btn ' + cls, 'aria-pressed': m && m.status === st ? 'true' : 'false', onclick: () => set(st), text: label });
  const rd = readSabaq(x.c.id, x.b.n, x.H.h); const rl = x.H.L && readClass(x.c.id, x.b.n, x.H.L);
  return h('div', { class: 'detail', id: 'detail', 'aria-label': `${code(x)} details` },
    h('div', { class: 'dcol' },
      rd ? h('a', { class: 'readlink', href: rd.url, target: 'rm' }, h('b', { text: 'Read the full sabaq' }), h('span', { text: `Reading Mode · ${rd.s.notes} editor notes · ${rd.s.q} open questions · ${rd.s.tc} teacher-only parts` })) : h('span', { class: 'small muted', text: 'Not in Reading Mode yet.' }),
      rl ? h('a', { class: 'readlink', href: rl, target: 'rm' }, h('b', { text: `Read the class lesson L${x.H.L}` }), h('span', { text: 'Reading Mode · the text written for the class' })) : null,
      h('span', { class: 'dk', text: 'Has' }), chipsOf(x.H.has),
      h('span', { class: 'dk', text: missing.length ? 'Still to make for class' : 'Class-ready' }),
      missing.length ? h('div', { class: 'chips' }, missing.map(n => h('span', { class: 'dchip miss', text: n }))) : h('span', { class: 'small muted', text: 'Everything for class is made.' }),
      (x.H.fasls || []).length ? [h('span', { class: 'dk', text: 'Built from' }), chain] : null),
    h('div', { class: 'dcol' },
      h('span', { class: 'dk', text: 'Mentor' }),
      h('div', { class: 'mbtns' }, btn('with', 'with mentor', 'Sent to mentor'), btn('rev', 'revising', 'Wants changes'), btn('fin', 'final', 'Final'),
        m ? h('button', { type: 'button', class: 'linkbtn', onclick: () => set(null), text: 'Clear' }) : null),
      h('label', { for: 'mnote', class: 'small muted', text: "Mentor's note, saved with the next button you press" }), note,
      h('span', { class: 'small muted', text: m ? `${mText(m)}, set ${m.updated} UTC` : 'No mentor round yet.' })));
}

// ---------- Atlases ----------
function faslState(f) { return f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).length ? 'o' : 'n'; }
const F_WORD = { b: 'built', w: 'written', br: 'only on a branch', o: 'planned, not built', n: 'not in the atlas lesson plan' };
function usersOf(atlasId, babN) { const o = []; S.data.courses.forEach(c => c.babs.forEach(b => { if (c.atlas === atlasId && b.from === babN) o.push({ c, b }); })); return o; }
function renderAtlas(p) {
  const v = $('#view'); v.replaceChildren();
  const order = ['mahdaviyat', 'tauheed', 'akhlaq', 'adl', 'maad', 'nubuwat', 'imamat'];
  const list = order.map(atlasOf).filter(Boolean).concat(S.data.atlases.filter(x => !order.includes(x.id)));
  const a = atlasOf(p.get('a') || 'mahdaviyat') || list[0];
  v.append(h('header', { class: 'head' }, h('h1', { text: 'Atlases' }), h('p', { class: 'lede', text: `${list.length} atlases drawn from the four scholars. Each one is split into Babs and Fasls, and any atlas can feed more than one course.` })));
  const tb = h('tbody');
  list.forEach(at => {
    const F = at.babs.flatMap(b => b.fasls); const built = F.filter(f => faslState(f) === 'b').length; const cs = S.data.courses.filter(c => c.atlas === at.id);
    tb.append(h('tr', { 'aria-current': at.id === a.id ? 'true' : null },
      h('td', {}, h('a', { class: 'aname', href: '#atlas?a=' + at.id }, ur(at.ur, 'big'), h('span', { text: at.name }))),
      h('td', { text: String(at.babs.length) }),
      h('td', { text: F.length ? F.length.toLocaleString('en') : 'being built' }),
      h('td', {}, h('span', { class: 'abar' }, h('span', { class: 'fbar' }, h('span', { style: `width:${F.length ? Math.max(100 * built / F.length, built ? 1 : 0) : 0}%` })), h('span', { class: 'cnt', text: F.length ? `${built} of ${F.length}` : 'not yet' }))),
      h('td', {}, cs.length ? cs.map(c => h('a', { class: 'use', href: '#course?c=' + c.id, text: `${c.code}, ${c.babs.length} Bab${c.babs.length === 1 ? '' : 's'}` })) : h('span', { class: 'muted small', text: 'No course yet' }))));
  });
  v.append(h('div', { class: 'panel flush' }, h('div', { class: 'scroll' }, h('table', { class: 'atable' }, h('thead', {}, h('tr', {}, ['Atlas', 'Babs', 'Fasls', 'Atlas lessons built', 'Used by'].map(t => h('th', { scope: 'col', text: t })))), tb))));

  if (!a.babs.length) return;
  const bab = a.babs.find(b => b.n === +p.get('b')) || a.babs.find(b => usersOf(a.id, b.n).length) || a.babs[0];
  const fl = legend([['f-b', 'Built'], ['f-w', 'Written'], ['f-br', 'Only on a branch'], ['f-n', 'Not yet']]);
  v.append(sec(h('h2', { class: 'bh' }, ur(a.ur, 'big'), h('span', { text: 'Babs' })), fl, h('div', { class: 'panel list cols2' }, a.babs.map(b => {
    const st = b.fasls.map(faslState); const n = b.fasls.length; const us = usersOf(a.id, b.n); const c = s => st.filter(x => x === s).length;
    return h('a', { class: 'abab', href: `#atlas?a=${a.id}&b=${b.n}`, 'aria-current': b.n === bab.n ? 'true' : null },
      h('span', { class: 'bn', text: 'B' + b.n }),
      h('span', { class: 'bt' }, ur(b.ur), h('span', { class: 'fbar thin' }, n ? [['b', 'f-b'], ['w', 'f-w'], ['br', 'f-br']].map(([s, cl]) => c(s) ? h('span', { class: cl, style: `width:${100 * c(s) / n}%` }) : null) : null)),
      h('span', { class: 'fc', text: n ? n + ' F' : '' }),
      h('span', { class: 'us' }, us.map(u => h('span', { class: 'use', text: `${u.c.code} B${u.b.n}` }))));
  }))));

  const users = usersOf(a.id, bab.n); const use = {};
  users.forEach(u => u.b.hub.forEach(H => (H.fasls || []).forEach(f => { const k = f.replace('U', ''); (use[k] = use[k] || []).push({ t: (users.length > 1 ? u.c.code + ' ' : '') + 'S' + H.h, x: { c: u.c, b: u.b, H } }); })));
  const st = bab.fasls.map(faslState);
  const right = h('span', { class: 'muted small' }, `${bab.fasls.length} Fasls · ${st.filter(x => x === 'b').length} atlas lessons built` + (users.length ? ' · used by ' : ''),
    users.map((u, i) => [i ? ', ' : '', h('a', { href: `#course?c=${u.c.id}&b=${u.b.n}`, text: `${u.c.code} B${u.b.n}` }), `, ${u.b.hub.length} hub sabaq`]));
  v.append(sec(h('h2', { class: 'bh' }, h('span', { text: `B${bab.n} Fasls` }), ur(bab.ur)), right,
    bab.note ? h('p', { class: 'note', text: bab.note }) : null,
    bab.fasls.length ? h('div', { class: 'panel list cols2' }, bab.fasls.map((f, i) => h('div', { class: 'frow' },
      readFasl(a.id, bab.n, f.id) ? h('a', { class: 'fn', href: readFasl(a.id, bab.n, f.id), target: 'rm', title: 'Read this atlas lesson', text: 'F' + f.id.split('.')[1] }) : h('span', { class: 'fn', text: 'F' + f.id.split('.')[1] }), h('i', { class: 'dot f-' + st[i], title: F_WORD[st[i]] }), readFasl(a.id, bab.n, f.id) ? h('a', { class: 'ft', href: readFasl(a.id, bab.n, f.id), target: 'rm', title: 'Read this atlas lesson in Reading Mode' }, ur(f.ur)) : ur(f.ur), h('span', { class: 'fs' }, (use[f.id] || []).map((o, k) => [k ? ', ' : '', h('a', { href: `#course?c=${o.x.c.id}&b=${o.x.b.n}&s=${sid(o.x)}`, title: 'Open this sabaq', text: o.t })])))))
      : h('div', { class: 'panel' }, h('p', { class: 'empty', text: a.state === 'done' ? 'No Fasls listed.' : 'Fasls are still being found by the atlas run.' }))));
  v.append(h('footer', { class: 'scholars' }, h('h2', { text: 'The four scholars' }), h('div', {},
    [['میرزا مہدی اصفہانی', '17 Arabic books'], ['آقائے حلبی', '212 lectures, 1 book'], ['آیت اللہ سید جعفر سیدان', '2,532 lectures, 14 books'], ['سید حسن افتخارزادہ', '3,122 lectures, 13 books']]
      .map(([n, s]) => h('span', {}, ur(n), h('span', { class: 'muted small', text: s }))))));
}

// ---------- Muqaddima and Tazzakur ----------
function renderOther(cid) {
  const v = $('#view');
  if (cid === 'mrf') { const m = S.data.muqaddima;
    v.append(h('header', { class: 'head' }, h('h1', {}, ur(m.ur, 'big', 'span')), h('p', { class: 'lede', text: `Muqaddima: ${m.lessons.length} lessons, written from its own source book, Maarif Zamina, not from an atlas.` })));
    v.append(sec('Lessons', legend([['dl write', 'Writing'], ['dl ref', 'Refining'], ['dl deck', 'Decks'], ['dl sup', 'Supplements'], ['dl media', 'Audio and reader']]),
      h('div', { class: 'panel flush' }, h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', { text: 'Lesson' }), h('th', { text: 'Title' }), h('th', { text: 'What it has' }))),
        h('tbody', {}, m.lessons.map(l => h('tr', {}, h('td', { class: 'code' }, readMrf(l.code) ? h('a', { href: readMrf(l.code), target: 'rm', title: 'Read in Reading Mode', text: l.code }) : l.code), h('td', {}, ur(l.ur)), h('td', {}, chipsOf(l.has)))))))))); return; }
  const z = S.data.tazzakur;
  v.append(h('header', { class: 'head' }, h('h1', { text: 'Tazzakur, class LMM-01' }), h('p', { class: 'lede', text: 'One session a week, each from one hadith, topic or occasion.' })));
  v.append(sec('Sessions', null, h('div', { class: 'panel flush' }, h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Session', 'Date', 'Starts from', 'Anchor', 'State'].map(t => h('th', { text: t })))),
    h('tbody', {}, z.sessions.map(s => h('tr', {}, h('td', { class: 'code' }, readTaz(s.code) ? h('a', { href: readTaz(s.code), target: 'rm', title: 'Read in Reading Mode', text: s.code }) : s.code), h('td', { text: fmtDay(s.date) }), h('td', { text: s.kind }), h('td', {}, ur(s.ur)), h('td', { text: s.state })))))))));
}

// ---------- mentor marks ----------
let saving = false;
async function saveMentor(x, entry) {
  if (saving) return; saving = true;
  const cid = x.c.id, key = unitKey(x.b.n, x.H.h);
  document.querySelectorAll('#detail .btn').forEach(b => { b.disabled = true; });
  const apply = board => { board.workmap = board.workmap || {}; board.workmap[cid] = board.workmap[cid] || {}; if (entry) board.workmap[cid][key] = entry; else delete board.workmap[cid][key]; return board; };
  const put = (board, sha) => gh('marks.json', { method: 'PUT', headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Work Map: ${cid} ${key} ${entry ? entry.status : 'cleared'}`, content: b64enc(JSON.stringify(board.workmap, null, 1) + '\n'), sha, branch: 'main' }) });
  try {
    let res;
    try { res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    catch (e) { if (e.status !== 409 && e.status !== 422) throw e; const fresh = await readJson('marks.json'); S.board = { workmap: fresh.data || {} }; S.boardSha = fresh.sha; res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    apply(S.board); S.boardSha = res.content.sha;
    toast(entry ? `Saved. ${code(x)} is ${mText(entry)}.` : `Cleared the mark on ${code(x)}.`);
    route();
  } catch (e) {
    toast(e.status === 403 || e.status === 404 ? 'Not saved. The key can read but not write: give it Contents, read and write.' : 'Not saved. ' + (e.message || e));
    document.querySelectorAll('#detail .btn').forEach(b => { b.disabled = false; });
  } finally { saving = false; }
}

try { window.name = 'wm'; } catch (e) {} // Reading Mode opens the Work Map in this same tab, and the Work Map opens Reading Mode in its one tab
if (getKey()) load(); else connect();
})();
