/* pagekit badge.js v1 (EX-44 plan P7.1). Shared by Work Map, Reading Mode and Maarif City.
   The ONE place where a page turns a lesson label into a unit and a layer badge. Pages never read lesson
   names themselves: they hand the label here. Data: layers.json (format in the kit's LAYERS-FORMAT.md).
   Do not edit a copy inside a page repo; the master is in ex44-system pagekit/, copied by pagekit.py.

   const L = EX44Badge.read(layersJson);
   L.unit('ZM', 'B1 S1')                  -> 'ZM-B01-001' (or null)
   L.unit('ZM', {bab: 1, hub: 1})         -> the same, from numbers: pages pass numbers, never build a label
                                             (keys: bab with sabaq, lesson or hub; or atlas: 'U15.1'; when several
                                             are given, the first that names a unit wins, in that order)
   L.badge('ZM', 'B1 S1', {view, kind})   -> {layer, word, tip, cls} or null
   L.html('ZM', 'B1 S1', {view, kind})    -> '<span class="ex44-badge ...">Preview</span>' or ''
   L.asOf(now)                            -> {text: 'as of 20 Nov, 10:55 UTC', old: false}
   view 'mentor' (the default) shows only Preview and Approved; view 'all' also shows In main and Draft. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const ORDER = ['approved', 'preview', 'main', 'branch'];
  const WORDS = { approved: 'Approved', preview: 'Preview', main: 'In main', branch: 'Draft' };
  const TIPS = {
    approved: 'The mentor approved it.',
    preview: 'Early work shown to the mentor.',
    main: 'In the master copy, not yet shown to the mentor.',
    branch: 'A chat is still working on it.'
  };
  const MENTOR = { approved: 1, preview: 1 };
  const OLD_HOURS = 6;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CSS = '.ex44-badge{display:inline-block;font:600 11px/1.6 system-ui,sans-serif;padding:0 6px;border-radius:8px;vertical-align:middle;white-space:nowrap}' +
    '.ex44-badge--approved{background:#d9f2e1;color:#14532d}.ex44-badge--preview{background:#fdf0c9;color:#713f12}' +
    '.ex44-badge--main{background:#e3e8f4;color:#1e3a8a}.ex44-badge--branch{background:#eee;color:#444}' +
    '.ex44-asof{font:12px system-ui,sans-serif;opacity:.75}.ex44-asof--old{color:#b45309;opacity:1}';

  // Label normalising lives here and nowhere else: case, spaces, dashes, leading zeros (S01 = S1).
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[\s_]+/g, ' ').trim()
    .replace(/(^|[ .])([A-Z]+)0+(\d)/g, '$1$2$3'); // namecheck: ok (the shared code itself)
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function best(kinds, kind) {
    const list = kind ? [kinds[kind]] : Object.values(kinds || {});
    let top = -1;
    for (const k of list) {
      if (!k) continue;
      ORDER.forEach((name, i) => {
        const v = k[name];
        if ((Array.isArray(v) ? v.length : v) && (top < 0 || i < top)) top = i;
      });
    }
    return top < 0 ? null : ORDER[top];
  }

  // Labels from numbers, so page code never glues one together: {bab: 2, sabaq: 5, hub: 5} -> ['B2 S5', 'B2 H5'].
  function fromParts(p) {
    if (p.atlas) return [String(p.atlas)];
    if (p.bab == null) return [];
    return [['sabaq', 'S'], ['lesson', 'L'], ['hub', 'H']].filter(([k]) => p[k] != null && p[k] !== '')
      .map(([k, letter]) => 'B' + p.bab + ' ' + letter + p[k]); // namecheck: ok (the shared code itself)
  }

  function read(data) {
    data = data || {};
    const courses = data.courses || {};
    const index = {};
    for (const code of Object.keys(courses)) {
      const c = courses[code], m = index[norm(code)] = {};
      for (const id of Object.keys(c.units || {})) m[norm(id)] = id;
      for (const a of Object.keys(c.aliases || {})) m[norm(a)] = c.aliases[a];
    }
    function unit(code, label) {
      const m = index[norm(code)];
      if (label && typeof label === 'object' && !Array.isArray(label)) {
        for (const l of fromParts(label)) { const v = unit(code, l); if (v) return v; }
        return null;
      }
      if (!m) return null;
      let k = norm(label);
      if (m[k] === undefined && k.indexOf(norm(code) + ' ') === 0) k = k.slice(norm(code).length + 1);
      const v = m[k];
      return v === undefined ? null : v; // a string, or a list when one alias names several units
    }
    function badge(code, label, opt) {
      opt = opt || {};
      const view = opt.view || 'mentor';
      let ids = unit(code, label);
      if (!ids) return null;
      if (!Array.isArray(ids)) ids = [ids];
      const units = (courses[(Object.keys(courses).find(k => norm(k) === norm(code)))] || {}).units || {};
      let top = -1;
      for (const id of ids) { const l = best((units[id] || {}).kinds, opt.kind); const i = ORDER.indexOf(l); if (i >= 0 && (top < 0 || i < top)) top = i; }
      if (top < 0) return null;
      const layer = ORDER[top];
      if (view === 'mentor' && !MENTOR[layer]) return null;
      return { layer, word: WORDS[layer], tip: TIPS[layer], cls: 'ex44-badge ex44-badge--' + layer };
    }
    function html(code, label, opt) {
      const b = badge(code, label, opt);
      return b ? `<span class="${b.cls}" title="${esc(b.tip)}">${esc(b.word)}</span>` : '';
    }
    function asOf(now) {
      const t = Date.parse(data.made || '');
      if (isNaN(t)) return { text: 'as of: not known', old: true };
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      const old = ((now == null ? Date.now() : +now) - t) / 36e5 > OLD_HOURS;
      return { text: `as of ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`, old };
    }
    function asOfHtml(now) {
      const a = asOf(now);
      return `<span class="ex44-asof${a.old ? ' ex44-asof--old' : ''}">${esc(a.text)}</span>`;
    }
    return { unit, badge, html, asOf, asOfHtml, made: data.made || null };
  }

  function injectCss(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || doc.getElementById('ex44-badge-css')) return;
    const s = doc.createElement('style'); s.id = 'ex44-badge-css'; s.textContent = CSS; doc.head.appendChild(s);
  }

  const api = { VERSION, ORDER, WORDS, read, injectCss, css: CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EX44Badge = api;
})(typeof self !== 'undefined' ? self : this);
