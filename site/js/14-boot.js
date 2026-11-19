'use strict';
/* ---------- boot ---------- */
(async function boot() {
  AUTH.wire(); AUTH.start();
  loadLocal(); route(); renderPlayer();
  try {
    const r = await fetch('data/words.json'); if (!r.ok) throw new Error('words');
    DATA = await r.json();
    DATA.words.forEach(w => WBY.set(w.k, w));
    const sp = {}; Object.values(DATA.sents).forEach(s => { if (s.n) sp[s.n[0]] = s.n[1]; });
    $('#speakers').textContent = Object.entries(sp).map(([u, l]) => u + ' (' + l + ')').join(', ');
    $('#buildInfo').textContent = DATA.v + ' · ' + DATA.words.length + ' palabras · ' + Object.keys(DATA.sents).length + ' frases.';
    renderAll();
  } catch (e) { toast('Error: ' + e.message); }
  initStore().finally(autoAdd);
})();
