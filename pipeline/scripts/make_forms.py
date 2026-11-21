"""Conjugation/declension tables for the word sheet -> data/forms.json (loaded lazily by the app).
Usage: python3 -I make_forms.py <wikt_subset.jsonl> <nouns_csv> <site_dir>"""
import csv, json, os, sys, collections
WK, NOUNS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
site = json.load(open(os.path.join(OUT, 'data', 'words.json')))
wk = collections.defaultdict(list)
for line in open(WK, encoding='utf-8'):
    d = json.loads(line)
    if d.get('forms'): wk[d['word']].append(d)
P = {('first-person', 'singular'): 0, ('second-person', 'singular'): 1, ('third-person', 'singular'): 2,
     ('first-person', 'plural'): 3, ('second-person', 'plural'): 4, ('third-person', 'plural'): 5}
def slot(t):
    for (a, b), i in P.items():
        if a in t and b in t: return i
AUX = {'haben': ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], 'sein': ['bin', 'bist', 'ist', 'sind', 'seid', 'sind']}
K2 = set('sein haben werden können müssen sollen wollen dürfen mögen wissen geben kommen gehen'.split())
def verb(lem, aux):
    for d in wk.get(lem, []):
        if d['pos'] != 'verb': continue
        pr, pt, k2, imp = [None] * 6, [None] * 6, [None] * 6, {}
        pp = None
        for f in d['forms']:
            t = set(f.get('tags') or []); x = f['form']
            if 'multiword-construction' in t or 'subjunctive-i' in t: continue
            if {'participle', 'past'} <= t and not pp: pp = x
            i = slot(t)
            if 'imperative' in t:
                if 'singular' in t: imp.setdefault('du', x)
                elif 'plural' in t: imp.setdefault('ihr', x)
                continue
            if i is None: continue
            if 'present' in t and 'indicative' in t and not pr[i]: pr[i] = x
            elif 'preterite' in t and 'indicative' in t and not pt[i]: pt[i] = x
            elif 'subjunctive-ii' in t and not k2[i]: k2[i] = x
        if not all(pr) or not pp: continue
        a = (aux or ['haben'])[0]
        e = {'pr': pr, 'pf': [AUX[a][i] + ' ' + pp for i in range(6)]}
        if all(pt): e['pt'] = pt
        if imp.get('du') and not imp['du'].startswith('-'):
            v3 = pr[5].split(' ', 1); sie = 'seien Sie' if lem == 'sein' else (v3[0] + ' Sie ' + v3[1] if len(v3) > 1 else pr[5] + ' Sie')
            e['imp'] = [imp['du'] + '!', (imp.get('ihr') or pr[4]) + '!', sie + '!']
        if lem in K2 and all(k2): e['k2'] = k2
        if aux and len(aux) > 1: e['pf2'] = [AUX[aux[1]][i] + ' ' + pp for i in range(6)]
        return e
rows = {}
for row in csv.DictReader(open(NOUNS, encoding='utf-8')):
    if row['pos'] == 'Substantiv' and row['lemma'] not in rows: rows[row['lemma']] = row
def col(r, name): return r.get(name) or r.get(name + ' 1') or ''
ART = {'m': ['der', 'des', 'dem', 'den'], 'f': ['die', 'der', 'der', 'die'], 'n': ['das', 'des', 'dem', 'das']}
PL = ['die', 'der', 'den', 'die']
CASES = ['nominativ', 'genitiv', 'dativ', 'akkusativ']
def noun(w, pl):
    lem = w.split(' ', 1)[-1]; art = w.split(' ', 1)[0] if ' ' in w else ''
    g = {'der': 'm', 'die': 'f', 'das': 'n'}.get(art)
    r = rows.get(lem)
    if not r or not g: return None
    sg = [col(r, c + ' singular') for c in CASES]
    if not all(sg): return None
    e = {'sg': [ART[g][i] + ' ' + sg[i] for i in range(4)]}
    if pl:
        p = [col(r, c + ' plural') for c in CASES]
        if all(p) and p[0] == pl: e['pl'] = [PL[i] + ' ' + p[i] for i in range(4)]
    return e
out, nv, nn = {}, 0, 0
for w in site['words']:
    c, lem = w['k'].split(':', 1)
    if w.get('vf'):
        e = verb(lem, w['vf'].get('aux'))
        if e: out[w['k']] = e; nv += 1
    elif c == 'N':
        e = noun(w['w'], w.get('pl'))
        if e: out[w['k']] = e; nn += 1
for k, x in site.get('ex', {}).items():
    c, lem = k.split(':', 1)
    if c == 'N':
        e = noun(x['w'], x.get('pl'))
        if e: out[k] = e; nn += 1
    elif lem in wk:
        e = verb(lem, None)
        if e: out[k] = e; nv += 1
json.dump(out, open(os.path.join(OUT, 'data', 'forms.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('verbs', nv, 'nouns', nn, 'bytes', os.path.getsize(os.path.join(OUT, 'data', 'forms.json')))
print(json.dumps({k: out.get(k) for k in ('W:gehen', 'W:anfangen', 'N:Hund', 'W:sein', 'W:können')}, ensure_ascii=False)[:1500])
