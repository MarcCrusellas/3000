'use strict';
const $ = (s, el = document) => el.querySelector(s);
const SR = 22050, GOAL = 12;
/* review intervals in days: after a right answer in bag 1, 2, 3; bag 4 doubles up to BAG_IV_MAX */
const BAG_IV = [0, 3, 7, 30], BAG_IV_MAX = 365;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const today = () => new Date().toLocaleDateString('sv-SE');
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ico = id => '<svg class="i"><use href="#i-' + id + '"/></svg>';
let DATA = null, WBY = new Map(), SEL = new Set(), DL = null;
