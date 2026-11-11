/* Maarif Work Map. Reads workmap.json, classes.json and board.json from the private hub repo with the
   viewer's own GitHub key (kept in this browser only); the mentor buttons write board.json back. */
(function () {
'use strict';
const OWNER = 'alimuqaddasm', HUB = 'hub', KEY = 'workmap.key';
const API = `https://api.github.com/repos/${OWNER}/${HUB}/contents/`;
const $ = s => document.querySelector(s);
const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
};
const ur = (t, cls, tag) => h(tag || 'span', { class: 'ur ' + (cls || ''), lang: 'ur', dir: 'rtl', text: t || '' });
const UD = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const setKey = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
const show = id => ['connect', 'loading', 'fail', 'week', 'map'].forEach(x => { $('#' + x).hidden = x !== id; });
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200); }

// ---------- GitHub contents API ----------
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
const b64enc = s => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
async function gh(path, opts) {
  const r = await fetch(API + path, Object.assign({ headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }, opts || {}));
  if (!r.ok) { const e = new Error(r.status === 401 ? 'The key was refused. It may have expired.' : r.status === 404 ? 'The hub repo or ' + path + ' was not found with this key.' : 'GitHub answered ' + r.status + '.'); e.status = r.status; throw e; }
  return r.json();
}
async function readJson(path) { const j = await gh(path); return { sha: j.sha, data: JSON.parse(b64dec(j.content)) }; }

// ---------- state ----------
const S = { data: null, classes: null, board: null, boardSha: null, atlas: 'mahdaviyat', openBab: null, sel: null };
const DEL = [['tc', 'Teacher Copy'], ['handout', 'Handout'], ['refined', 'Refined handout'], ['proof', 'Print proof'], ['main', 'Main deck'], ['extra', 'Extra deck'], ['qa', 'QA deck'], ['tafseer', 'Tafseer'], ['flow', 'Flowchart'], ['research', 'Extra research'], ['audio', 'Audio'], ['reader', 'Reader']];
const STAGES = [['plan', 'In the hub', 'var(--s0)'], ['tc', 'Teacher Copy', 'var(--s1)'], ['ref', 'Refined', 'var(--s2)'], ['class', 'Class-ready', 'var(--s3)']];
const stage = has => { const s = new Set(has || []); if (s.has('main') || s.has('extra') || s.has('qa')) return 'class'; if (s.has('refined') || s.has('proof')) return 'ref'; if (s.has('tc') || s.has('text')) return 'tc'; return 'plan'; };
const STCOL = { plan: 'var(--s0)', tc: 'var(--s1)', ref: 'var(--s2)', class: 'var(--s3)' };
const unitKey = (b, s) => `B${b} S${s}`;
const mentorOf = (cid, b, s) => (((S.board.workmap || {})[cid] || {})[unitKey(b, s)]) || null;
const MCOL = { 'with mentor': 'var(--ink)', revising: 'var(--coral)', final: 'var(--teal)' };
const mLabel = m => !m ? '' : m.status === 'revising' ? `revising r${m.round || 1}` : m.status;
const course = cid => S.data.courses.find(c => c.id === cid);
const atlasOf = id => S.data.atlases.find(a => a.id === id);

// ---------- load ----------
async function load() {
  show('loading'); $('#tabs').hidden = true; $('#forget').hidden = false;
  try {
    const [w, c, b] = await Promise.all([readJson('workmap.json'), readJson('classes.json'), readJson('board.json')]);
    S.data = w.data; S.classes = c.data; S.board = b.data; S.boardSha = b.sha;
    if (!S.board.workmap) S.board.workmap = {};
    $('#made').textContent = 'Read from the repos · ' + S.data.made;
    $('#tabs').hidden = false; route();
  } catch (e) {
    if (e.status === 401) { setKey(''); connect(e.message); return; }
    $('#failmsg').textContent = e.message || String(e); show('fail');
  }
}
function connect(msg) {
  show('connect'); $('#tabs').hidden = true; $('#forget').hidden = true; $('#made').textContent = '';
  $('#keyerr').hidden = !msg; $('#keyerr').textContent = msg || '';
}
$('#keyform').addEventListener('submit', e => { e.preventDefault(); const v = $('#key').value.trim(); if (!v) return; setKey(v); $('#key').value = ''; load(); });
$('#forget').addEventListener('click', () => { setKey(''); S.data = null; connect('Key removed from this browser.'); });
$('#retry').addEventListener('click', load);

function route() {
  if (!S.data) return;
  const v = location.hash === '#map' ? 'map' : 'week';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
  if (v === 'map') renderMap(); else renderWeek();
  show(v);
}
window.addEventListener('hashchange', route);

// ---------- helpers over the data ----------
function allSabaq() {
  const out = [];
  S.data.courses.forEach(c => c.babs.forEach(b => b.hub.forEach(H => out.push({ c, b, H }))));
  return out;
}
function faslTitle(atlasId, uid) {
  const [bn] = uid.replace('U', '').split('.');
  const a = atlasOf(atlasId); const bab = a && a.babs.find(x => x.n === +bn);
  const f = bab && bab.fasls.find(x => x.id === uid.replace('U', ''));
  return f ? f.ur : '';
}
const fcode = (atlasName, uid) => { const [b, f] = uid.replace('U', '').split('.'); return `${atlasName} B${b} F${f}`; };

// ---------- This week ----------
function renderWeek() {
  const root = $('#week'); root.replaceChildren();
  const all = allSabaq();
  const planned = all.filter(x => x.H.L && x.H.Ls === 'planned').sort((a, b) => a.H.L - b.H.L);
  const withM = all.filter(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); return m && m.status === 'with mentor'; });
  const revising = all.filter(x => { const m = mentorOf(x.c.id, x.b.n, x.H.h); return m && m.status === 'revising'; });
  const decisions = [];
  revising.forEach(x => decisions.push({ code: `${x.c.code} B${x.b.n} S${x.H.h} · mentor wants changes`, en: (mentorOf(x.c.id, x.b.n, x.H.h).note || 'See the note'), sel: x }));
  S.data.atlases.forEach(a => a.babs.forEach(b => { if (b.note && b.branch && (b.branch.counts.refined || 0) > 20) decisions.push({ code: `${a.name} B${b.n}`, en: `${b.branch.counts.refined} Fasl lessons refined on branch ${b.branch.name}, waiting for your review` }); }));
  const changes = (S.data.changes || []).slice(0, 4);
  const item = (code, body, isUr, sel) => {
    const inner = [h('span', { class: 'code', text: code }), isUr ? ur(body) : h('span', { class: 'en', text: body })];
    return h('div', { class: 'it' }, sel ? h('button', { type: 'button', onclick: () => openPanel(sel) }, inner) : inner);
  };
  const box = (title, color, n, items, empty) => h('div', { class: 'card wk' },
    h('div', { class: 'hd' }, h('b', { style: 'color:' + color, text: title }), h('span', { text: n })),
    items.length ? items : h('div', { class: 'it' }, h('span', { class: 'en muted', text: empty })));
  root.append(h('div', { class: 'sec-head' }, h('h1', { text: 'This week' }), h('span', { class: 'muted small', text: `${all.length} hub sabaq in ${S.data.courses.length} courses` })));
  root.append(h('div', { class: 'week' },
    box('Next to teach', '#8a6a12', planned.length, planned.slice(0, 4).map(x => item(`${x.c.code} B${x.b.n} L${x.H.L} · from S${x.H.h}`, x.H.ur, true, x)), 'No class lesson is planned. Tell Claude "teach ZM B1 S12 as L6".'),
    box('Needs your decision', 'var(--coral)', decisions.length, decisions.slice(0, 4).map(d => item(d.code, d.en, false, d.sel)), 'Nothing waiting.'),
    box('With the mentor', 'var(--ink)', withM.length, withM.slice(0, 4).map(x => item(`${x.c.code} B${x.b.n} S${x.H.h}${x.H.L ? ' · L' + x.H.L : ''}`, x.H.ur, true, x)), 'Nothing marked. Open a sabaq and press Sent to mentor.'),
    box('Changed in the last day', 'var(--teal-ink)', (S.data.changes || []).length, changes.map(c => item(`${c.repo} · ${c.ref === 'main' ? 'main' : 'branch ' + c.ref}`, `${c.n} commit${c.n === 1 ? '' : 's'}. Last: ${c.last}`, false)), 'No commits in the last 24 hours.')));

  // class lessons
  const tracks = [];
  S.data.courses.forEach(c => c.babs.forEach(b => {
    const ls = b.hub.filter(H => H.L).sort((p, q) => p.L - q.L);
    if (ls.length) tracks.push({ c, b, ls });
  }));
  const tsec = h('section', { style: 'display:flex;flex-direction:column;gap:14px' },
    h('div', { class: 'sec-head' }, h('h2', {}, 'Class lessons ', ur('درس')), h('span', { class: 'muted small', text: 'In teaching order. Each L shows the hub sabaq it came from.' })));
  tracks.forEach(t => {
    const a = atlasOf(t.c.atlas); const ab = a.babs.find(x => x.n === t.b.from);
    tsec.append(h('div', { class: 'card track' },
      h('div', { class: 'tt' }, ur(`${t.c.ur} · باب ${UD(t.b.n)}`), h('span', { class: 'muted small', dir: 'ltr', text: `${t.c.code} B${t.b.n} · from ${a.name} B${t.b.from}${ab ? '' : ''} · ${t.b.hub.length} sabaq in the hub` })),
      h('div', { class: 'ls' }, t.ls.map(H => h('button', { type: 'button', class: 'lcard ' + (H.Ls === 'planned' ? 'planned' : ''), onclick: () => openPanel({ c: t.c, b: t.b, H }) },
        h('span', { class: 'r1' }, h('span', { text: 'from S' + H.h }), h('b', { text: 'L' + H.L })), ur(H.ur), h('span', { class: 'st', text: H.Ls === 'planned' ? 'planned' : 'taught' + (mLabel(mentorOf(t.c.id, t.b.n, H.h)) ? ' · ' + mLabel(mentorOf(t.c.id, t.b.n, H.h)) : '') }))))));
  });
  root.append(tsec);

  // every hub sabaq
  const counts = { plan: 0, tc: 0, ref: 0, class: 0 }; all.forEach(x => counts[stage(x.H.has)]++);
  const g = h('div', { class: 'sgrid' }, h('span', { class: 'h first', text: 'Course · Bab' }),
    STAGES.map(([k, n, col]) => h('span', { class: 'h', style: 'border-bottom-color:' + col }, h('span', { text: n }), h('span', { class: 'muted', text: counts[k] }))));
  S.data.courses.forEach(c => c.babs.forEach(b => {
    if (!b.hub.length) return;
    const a = atlasOf(c.atlas); const ab = a.babs.find(x => x.n === b.from);
    g.append(h('div', { class: 'rh' }, h('b', { text: `${c.code} B${b.n}` }), ur(ab ? ab.ur : '')));
    STAGES.forEach(([k]) => g.append(h('div', { class: 'c' }, b.hub.filter(H => stage(H.has) === k).map(H => {
      const m = mentorOf(c.id, b.n, H.h);
      return h('button', { type: 'button', class: 'chip' + (H.L ? ' L' : ''), title: H.ur, 'aria-label': `${c.code} B${b.n} S${H.h}${H.L ? ', L' + H.L : ''}${m ? ', ' + mLabel(m) : ''}`, onclick: () => openPanel({ c, b, H }) },
        'S' + H.h, m ? h('i', { style: 'background:' + MCOL[m.status] }) : null);
    }))));
  }));
  root.append(h('section', { style: 'display:flex;flex-direction:column;gap:14px' },
    h('div', { class: 'sec-head' }, h('h2', {}, 'Every hub sabaq ', ur('سبق')), h('span', { class: 'muted small', text: 'Stage is read from the files. The mentor mark is yours. Click a sabaq for its chain, what it has, and the mentor buttons.' })),
    h('div', { class: 'card grid-wrap' }, g),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'sw', style: 'background:#fff;box-shadow:inset 0 0 0 2px var(--gold)' }), 'a class lesson, taught or planned'),
      h('span', {}, h('i', { class: 'sw', style: 'border-radius:50%;background:var(--ink)' }), 'with mentor'),
      h('span', {}, h('i', { class: 'sw', style: 'border-radius:50%;background:var(--coral)' }), 'revising'),
      h('span', {}, h('i', { class: 'sw', style: 'border-radius:50%;background:var(--teal)' }), 'final'))));
}

// ---------- Map ----------
function renderMap() {
  const root = $('#map'); root.replaceChildren();
  root.append(h('div', { class: 'sec-head' }, h('h1', { text: 'From the scholars to the class' }), ur('علما کا کلام، اطلس، ہب، سبق، درس', '', 'p')));
  const sch = h('div', { class: 'card sch' }, h('span', { class: 'k', text: 'Four scholars, as text' }),
    [['میرزا مہدی اصفہانی', '17 Arabic books'], ['آقائے حلبی', '212 lectures, 1 book'], ['آیت اللہ سید جعفر سیدان', '2,532 lectures, 14 books'], ['سید حسن افتخارزادہ', '3,122 lectures, 13 books']]
      .map(([n, s]) => h('div', { class: 'p' }, ur(n), h('span', { class: 'muted small', text: s }))));
  const feeds = {};
  S.data.courses.forEach(c => c.babs.forEach(b => {
    const st = b.hub.map(H => stage(H.has));
    feeds[c.atlas + ':' + b.from] = { c, b, k: !b.hub.length ? 'p' : st.some(x => x === 'ref' || x === 'class') ? 'f' : st.some(x => x === 'tc') ? 't' : 'h' };
  }));
  const CELL = { '.': 'background:#e3e8e2', p: 'box-shadow:inset 0 0 0 1.5px var(--teal)', h: 'background:var(--s1)', t: 'background:var(--s2)', f: 'background:var(--s3)' };
  const atl = h('div', { class: 'card atl' }, h('div', { class: 'arow head' }, h('span', { text: 'Atlas' }), h('span', { class: 'hide-s', text: 'Babs and their hubs' }), h('span', { class: 'hide-s' }), h('span', { text: 'Course' })));
  const order = ['mahdaviyat', 'tauheed', 'akhlaq', 'adl', 'maad', 'nubuwat', 'imamat'];
  order.map(atlasOf).filter(Boolean).forEach(a => {
    const nf = a.babs.reduce((n, b) => n + b.fasls.length, 0);
    const cs = S.data.courses.filter(c => c.atlas === a.id);
    atl.append(h('div', { class: 'arow' },
      h('div', { class: 'nm' }, ur(a.ur), h('span', { class: 'muted small', text: `${a.babs.length} Babs · ${a.state === 'done' ? nf + ' Fasls' : 'being built'}` })),
      h('div', { class: 'cells hide-s' }, a.babs.map(b => h('i', { title: `B${b.n}`, style: CELL[(feeds[a.id + ':' + b.n] || { k: '.' }).k] }))),
      h('span', { class: 'hide-s muted', 'aria-hidden': 'true', text: cs.length ? '→' : '' }),
      h('div', { class: 'co' }, cs.length ? cs.map(c => [ur(c.ur), h('span', { class: 'muted small', text: `${c.code}: B${c.babs.map(b => b.from).join(', ')} → B${c.babs.map(b => b.n).join(', ')}` })]) : h('span', { class: 'muted small', text: a.state === 'done' ? 'no course yet' : '' }))));
  });
  atl.append(h('div', { class: 'legend', style: 'padding:12px 20px' },
    h('span', {}, h('i', { class: 'sw', style: CELL['.'] }), 'no hub'), h('span', {}, h('i', { class: 'sw', style: CELL.p }), 'hub decided'),
    h('span', {}, h('i', { class: 'sw', style: CELL.h }), 'hub drafted'), h('span', {}, h('i', { class: 'sw', style: CELL.t }), 'Teacher Copies written'), h('span', {}, h('i', { class: 'sw', style: CELL.f }), 'sabaq finished')));
  root.append(h('div', { class: 'lineage' }, sch, atl));

  // atlas tabs and Bab table
  const pills = h('div', { class: 'pills', role: 'tablist', 'aria-label': 'Atlas' }, order.map(atlasOf).filter(Boolean).map(a =>
    h('button', { type: 'button', role: 'tab', class: 'pill' + (S.atlas === a.id ? ' on' : ''), 'aria-selected': S.atlas === a.id ? 'true' : 'false', onclick: () => { S.atlas = a.id; S.openBab = null; renderMap(); } }, a.ur)));
  const a = atlasOf(S.atlas);
  const tab = h('div', { class: 'card btab' }, h('div', { class: 'brow head' }, ur('باب'), ur('عنوان'), h('span', { class: 'en hide-s', text: 'Atlas lessons' }), h('span', { class: 'en', text: 'Built' }), h('span', { class: 'en hide-s', text: 'Hub' })));
  a.babs.forEach(b => {
    const st = b.fasls.map(f => f.br ? 'br' : (f.al || []).includes('built') ? 'b' : (f.al || []).includes('written') ? 'w' : (f.al || []).some(x => x === 'running') ? 'r' : (f.al || []).length ? 'o' : '-').filter(x => x !== '-');
    const n = st.length; const cnt = k => st.filter(x => x === k).length;
    const bar = h('div', { class: 'bar hide-s' }, n ? [['b', 'var(--teal)'], ['w', 'var(--s1)'], ['br', 'var(--branch)'], ['r', '#f1d9a0']].map(([k, col]) => cnt(k) ? h('span', { style: `width:${100 * cnt(k) / n}%;background:${col}` }) : null) : null);
    const fe = feeds[a.id + ':' + b.n];
    let hub = h('span', { class: 'hubchip none hide-s', text: 'no hub' });
    if (fe) { const nl = fe.b.hub.filter(H => H.L).length; hub = h('span', { class: 'hubchip hide-s' + (nl ? ' class' : ''), text: fe.b.hub.length ? `${fe.c.code} B${fe.b.n} · ${fe.b.hub.length} S${nl ? ' · ' + nl + ' L' : ''}` : `${fe.c.code} B${fe.b.n} · ${fe.b.hub_state.split(',')[0]}` }); }
    const open = S.openBab === b.n;
    tab.append(h('button', { type: 'button', class: 'brow', 'aria-expanded': open ? 'true' : 'false', onclick: () => { S.openBab = open ? null : b.n; renderMap(); } },
      h('span', { class: 'n', text: 'باب ' + UD(b.n) }), h('span', { class: 't', text: b.ur, lang: 'ur' }), bar,
      h('span', { class: 'cnt', text: !n ? (a.state === 'done' ? 'none yet' : '') : cnt('br') ? cnt('br') + ' on branch' : `${cnt('b')} / ${n}` }), hub));
    if (open) {
      const fl = h('div', { class: 'flist' }, h('span', { class: 'colhead', text: `${a.name} B${b.n} · ${b.fasls.length} Fasls` }), b.fasls.map(f => {
        const al = f.al || []; const k = f.br ? ['br', 'branch: ' + f.br] : al.includes('built') ? ['built', 'built'] : al.includes('written') ? ['written', 'written'] : al.includes('running') ? ['running', 'started'] : al.includes('held') ? ['held', 'held'] : al.length ? ['todo', 'not started'] : ['notm1', 'not M1'];
        return h('div', { class: 'f' }, h('span', { class: 'code', text: 'F' + f.id.split('.')[1] }), ur(f.ur), h('span', { class: 'tag ' + k[0], text: k[1] }));
      }));
      if (!b.fasls.length) fl.append(h('p', { class: 'muted small', dir: 'ltr', text: 'Fasls are still being found by the atlas run.' }));
      const right = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
      if (fe && fe.b.hub.length) {
        right.append(h('span', { class: 'colhead' }, `${fe.c.code} B${fe.b.n} · hub ${fe.b.hub_state} · ${fe.b.hub.length} sabaq `, ur(`${fe.c.ur} · باب ${UD(fe.b.n)}`)));
        right.append(h('div', { class: 'stiles' }, fe.b.hub.map(H => h('button', { type: 'button', class: 'stile' + (H.L ? ' L' : ''), onclick: () => openPanel({ c: fe.c, b: fe.b, H }) },
          h('span', { class: 'r1' }, h('i', { style: 'background:' + STCOL[stage(H.has)] }), ur('سبق ' + UD(H.h)), H.L ? h('b', { text: 'L' + H.L + (H.Ls === 'planned' ? ' planned' : '') }) : null),
          ur(H.ur, 't'), h('span', { class: 'has', text: DEL.filter(([k]) => H.has.includes(k)).map(([, n]) => n).slice(0, 3).join(' · ') || 'planned only' })))));
      } else right.append(h('p', { class: 'muted small', dir: 'ltr', text: fe ? `${fe.c.code} B${fe.b.n}: ${fe.b.hub_state}.` : 'This Bab has not been made into a hub yet.' }));
      tab.append(h('div', { class: 'bopen' }, b.note ? h('div', { class: 'note', text: b.note }) : null, fl, right));
    }
  });
  root.append(h('section', { style: 'display:flex;flex-direction:column;gap:14px' }, pills, tab,
    h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'sw', style: 'background:var(--teal)' }), 'atlas lesson built'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--s1)' }), 'written'),
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--branch)' }), 'done on a branch, not in main'), h('span', {}, h('i', { class: 'sw', style: 'background:#f1d9a0' }), 'started'), h('span', {}, h('i', { class: 'sw', style: 'background:var(--soft)' }), 'not started'))));

  // Muqaddima and Tazzakur
  const m = S.data.muqaddima;
  const mt = h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Lesson' }), h('th', { text: 'Title' }), h('th', { text: 'What it has' })),
    m.lessons.map(l => h('tr', {}, h('td', { text: l.code }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: l.ur }), h('td', {}, h('div', { class: 'chips' }, DEL.filter(([k]) => l.has.includes(k)).map(([, n]) => h('span', { class: 'd', text: n })))))));
  const z = S.data.tazzakur;
  const zt = h('table', { class: 't' }, h('tr', {}, h('th', { text: 'Session' }), h('th', { text: 'Date' }), h('th', { text: 'Starts from' }), h('th', { text: 'Anchor' }), h('th', { text: 'State' })),
    z.sessions.map(s => h('tr', {}, h('td', { text: s.code }), h('td', { text: s.date }), h('td', { text: s.kind }), h('td', { class: 'ur', lang: 'ur', dir: 'rtl', text: s.ur }), h('td', { text: s.state }))));
  root.append(h('section', { style: 'display:flex;flex-direction:column;gap:14px' }, h('h2', { text: 'Maarif courses not built from an atlas' }),
    h('div', { class: 'card', style: 'padding:16px 20px;display:flex;flex-direction:column;gap:8px' }, h('div', { class: 'sec-head' }, ur(m.ur), h('span', { class: 'muted small', text: `Muqaddima · ${m.repo} · written from the Maarif Zamina source book` })), h('div', { class: 'grid-wrap' }, mt)),
    h('div', { class: 'card', style: 'padding:16px 20px;display:flex;flex-direction:column;gap:8px' }, h('div', { class: 'sec-head' }, h('b', { text: 'Tazzakur · class LMM-01' }), h('span', { class: 'muted small', text: z.repo })), h('div', { class: 'grid-wrap' }, zt))));
}

// ---------- sabaq panel and mentor buttons ----------
let lastFocus = null;
function openPanel(x) {
  S.sel = x; lastFocus = document.activeElement;
  const { c, b, H } = x; const a = atlasOf(c.atlas); const m = mentorOf(c.id, b.n, H.h);
  const p = $('#panel'); p.replaceChildren();
  p.append(h('div', { class: 'top' }, h('h3', { id: 'dtitle', text: `${c.code} B${b.n} S${H.h}` }),
    H.L ? h('span', { class: 'tag', style: 'background:var(--gold-bg);color:var(--gold-ink);font-size:13px;padding:2px 8px', text: (H.Ls === 'planned' ? 'planned as L' : 'taught as L') + H.L }) : null,
    h('button', { type: 'button', class: 'btn', 'data-close': '', 'aria-label': 'Close', text: 'Close' })));
  p.append(ur(H.ur, 'ttl', 'p'));
  p.append(h('div', { class: 'chain' }, h('span', { class: 'k', text: 'Where it comes from' }),
    (H.fasls || []).length ? H.fasls.map(u => [h('b', { class: 'small', text: fcode(a.name, u) }), ur(faslTitle(a.id, u))]) : h('span', { class: 'small muted', text: `${a.name} B${b.from}` }),
    h('span', { class: 'small muted', text: `→ ${c.code} B${b.n} S${H.h} in the hub${H.L ? ` → ${c.code} B${b.n} L${H.L} in class` : ''}` })));
  p.append(h('div', { class: 'checks' }, h('b', { class: 'small muted', style: 'padding-bottom:4px', text: 'What it has' }),
    DEL.map(([k, n]) => H.has.includes(k) ? h('div', { class: 'yes' }, h('span', { text: n }), h('b', { text: 'done' })) : h('div', { class: 'no' }, h('span', { text: n }), h('b', { text: 'not yet' })))));
  const note = h('input', { id: 'mnote', type: 'text', placeholder: "What the mentor asked for", value: m && m.note ? m.note : '' });
  const set = async status => {
    const prev = mentorOf(c.id, b.n, H.h);
    const round = status === 'revising' ? ((prev && prev.round) || 0) + 1 : (prev && prev.round) || 0;
    await saveMentor(c.id, b.n, H.h, status ? { status, round, note: note.value.trim(), updated: new Date().toISOString().slice(0, 16) } : null);
  };
  p.append(h('div', { class: 'mentor' }, h('b', { class: 'small muted', text: 'Mentor' }),
    h('span', { class: 'mstate', style: 'color:' + (m ? MCOL[m.status] : 'var(--muted)'), text: m ? `${mLabel(m)} · ${m.updated} UTC` : 'Not marked' }),
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'btn dark', 'aria-pressed': m && m.status === 'with mentor' ? 'true' : 'false', onclick: () => set('with mentor'), text: 'Sent to mentor' }),
      h('button', { type: 'button', class: 'btn coral', 'aria-pressed': m && m.status === 'revising' ? 'true' : 'false', onclick: () => set('revising'), text: 'Mentor wants changes' }),
      h('button', { type: 'button', class: 'btn teal', 'aria-pressed': m && m.status === 'final' ? 'true' : 'false', onclick: () => set('final'), text: 'Final' }),
      m ? h('button', { type: 'button', class: 'link', onclick: () => set(null), text: 'Clear' }) : null),
    h('label', { for: 'mnote', class: 'small muted', text: "Mentor's note (saved with the next button you press)" }), note));
  $('#drawer').hidden = false; p.querySelector('[data-close]').focus();
}
function closePanel() { $('#drawer').hidden = true; S.sel = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
$('#drawer').addEventListener('click', e => { if (e.target.closest('[data-close]')) closePanel(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closePanel(); });

let saving = false;
async function saveMentor(cid, b, s, entry) {
  if (saving) return; saving = true;
  const key = unitKey(b, s);
  const apply = board => { board.workmap = board.workmap || {}; board.workmap[cid] = board.workmap[cid] || {};
    if (entry) board.workmap[cid][key] = entry; else delete board.workmap[cid][key]; return board; };
  const put = (board, sha) => gh('board.json', { method: 'PUT', headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Work Map: ${cid} ${key} ${entry ? entry.status : 'cleared'}`, content: b64enc(JSON.stringify(board, null, 1) + '\n'), sha, branch: 'main' }) });
  try {
    let res;
    try { res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    catch (e) { if (e.status !== 409 && e.status !== 422) throw e; const fresh = await readJson('board.json'); S.board = fresh.data; S.boardSha = fresh.sha; res = await put(apply(JSON.parse(JSON.stringify(S.board))), S.boardSha); }
    apply(S.board); S.boardSha = res.content.sha;
    toast(entry ? `Saved: ${key} is ${mLabel(entry)}` : `Cleared ${key}`);
    const sel = S.sel; route(); if (sel) openPanel(sel);
  } catch (e) {
    toast(e.status === 403 || e.status === 404 ? 'Not saved: the key can read but not write. Give it Contents: Read and write.' : 'Not saved: ' + (e.message || e));
  } finally { saving = false; }
}

// ---------- start ----------
if (getKey()) load(); else connect();
})();
