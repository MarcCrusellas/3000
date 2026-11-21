"""Append the new words and sentences to words.json (keys and order of the existing words stay as they are).

Usage: python3 -I merge.py <build_dir> <parsed.pkl> <nouns_csv> <wikt_subset.jsonl> <newwords.json> <sel.json> <site_dir> <render_out.json>

- new list words get r, k, c, w, pl, g, s, hl, gp, p (+ vf / cmp / cs from Wiktionary, like lexicon_step2.py)
- old words get their extra sentences appended to s / hl / gp
- own sentences (supplement_2.tsv) become c<n> ids; Tatoeba ones t<id>
- every sentence gets L = 1 when it has 11 words or more (the app keeps those out of most review tests)
- ex: list words leave it; glossed non-list words used in sentences join it
- token maps only keep keys the app can show (list words and ex)
- forms.json gets tables for the new words and extras that have none yet
- writes the list of sentences that need audio to <render_out.json>"""
import collections, csv, json, os, pickle, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.join(HERE, '..')]
from dekeys import key_of, cls_of, LEMMA_FIX
from remap import REMAP
B, PK, NOUNS, WK, NEW, SEL, SITE, RL = sys.argv[1].rstrip('/') + '/', *sys.argv[2:9]
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
PART = ('an', 'auf', 'aus', 'ein', 'mit', 'vor', 'zu', 'ab', 'nach', 'weg', 'zurück', 'los', 'fest', 'her', 'hin', 'heraus', 'hinaus',
        'vorbei', 'statt', 'teil', 'fern', 'bei', 'um', 'durch', 'über', 'unter', 'wieder')
wp = os.path.join(SITE, 'data', 'words.json'); fp = os.path.join(SITE, 'data', 'forms.json')
site = json.load(open(wp)); forms = json.load(open(fp))
new = json.load(open(NEW)); sel = json.load(open(SEL)); ranks = json.load(open(B + 'ranks.json'))
P = pickle.load(open(PK, 'rb'))

def tsv(name):
    out = {}
    for line in open(B + name, encoding='utf-8'):
        p = line.rstrip('\n').split('\t'); out[p[0]] = p[1:]
    return out
G2 = tsv('glosses_es_2.tsv'); XG = tsv('extra_glosses_2.tsv')
sup = collections.defaultdict(list)
for line in open(B + 'supplement_2.tsv', encoding='utf-8'):
    k, de, es = line.rstrip('\n').split('\t'); sup[k].append((de, es))

nouns = {}
for row in csv.DictReader(open(NOUNS, encoding='utf-8')):
    if row['pos'] != 'Substantiv' or row['lemma'] in nouns: continue
    nouns[row['lemma']] = (row.get('genus') or row.get('genus 1') or '', row.get('nominativ plural') or row.get('nominativ plural 1') or '')
ART = {'m': 'der', 'f': 'die', 'n': 'das'}

# ---------- list words ----------
listk = {w['k'] for w in site['words']} | {e['k'] for e in new}
for k in list(site['ex']):
    if k in listk: del site['ex'][k]
ex = site['ex']
gloss_any = {k: v[0] for k, v in G2.items()}; gloss_any.update({k: v[0] for k, v in XG.items()})

def ex_entry(k):
    c, lem = k.split(':', 1)
    e = {'g': gloss_any[k], 'r': ranks.get(k), 'w': lem}
    if c == 'N':
        g, pl = nouns.get(lem, ('', ''))
        if g in ART: e['w'] = ART[g] + ' ' + lem
        if pl and pl not in ('—', '-'): e['pl'] = pl
        opts = dict(o.split('=', 1) for o in (G2.get(k) or XG.get(k))[1:])
        if 'w' in opts: e['w'] = opts['w']
        if opts.get('pl') == '-': e.pop('pl', None)
        elif 'pl' in opts: e['pl'] = opts['pl']
    return e

def clean_map(m):
    out = {}
    for s, k in m.items():
        k = REMAP.get(k, k)
        if k not in listk and k not in ex:
            if k not in gloss_any: continue
            ex[k] = ex_entry(k)
        out[s] = k
    return out

def nwc(text): return len(WORD.findall(text))

# ---------- sentences ----------
render = []
for sid, x in sel['sents'].items():
    site['sents'][sid] = {'de': x['de'], 'es': x['es'], 'a': {}, 't': x['t'], 'm': clean_map(x['m'])}
    render.append(sid)

import spacy
nlp = spacy.load('de_core_news_md', disable=['ner'])
def parse_map(text):
    m = {}
    for t in nlp(text):
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            l = t.lemma_.lower() + t.head.lemma_.lower(); k = 'W:' + LEMMA_FIX.get(l, l)
        else:
            lemma = t.lemma_; svp = [c for c in t.children if c.dep_ == 'svp']
            if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
            k = key_of((t.text, t.pos_, lemma, ''))
        if k and not k.startswith(('P:', 'X:')) and t.text not in m: m[t.text] = k
    return m
cid = max([int(s[1:]) for s in site['sents'] if s.startswith('c')] + [0])

def hl_gp(k, sid):
    f = sorted(s for s, kk in site['sents'][sid]['m'].items() if kk == k)
    v = [x for x in f if x.lower() not in PART]
    return f, (v or f or [''])[0]

# fine POS and class from the corpus parse
pos = collections.defaultdict(collections.Counter); cls = collections.defaultdict(collections.Counter)
for x in P.values():
    for t in x['toks']:
        k = key_of(t)
        if not k: continue
        k = REMAP.get(k, k); pos[k][t[1]] += 1; cls[k][cls_of(t[1])] += 1

nw = {e['k']: e for e in new}
dropped = []
for x in sel['new']:
    e = nw[x['k']]; k = e['k']; c0 = k.split(':', 1)[0]
    g = G2[k][0]; opts = dict(o.split('=', 1) for o in G2[k][1:])
    w = {'r': e['r'], 'k': k}
    if c0 == 'N': w['c'] = 'N'
    else:
        mc = [c for c, _ in cls[k].most_common() if c not in ('N', 'P', 'X')]
        w['c'] = mc[0] if mc else 'A'
    w['c'] = {'W:sodass': 'F'}.get(k, w['c'])   # spaCy tags it as a verb now and then
    w['w'] = opts.get('w', e['w']); pl = opts.get('pl', e['pl'])
    w['pl'] = '' if pl == '-' else pl
    w['g'] = g; w['s'], w['hl'], w['gp'] = [], [], []
    sids = list(x['s'])
    for de, es in sup.get(k, [])[:x['sup']]:
        cid += 1; sid = 'c%d' % cid
        site['sents'][sid] = {'de': de, 'es': es, 'a': {}, 'm': clean_map(parse_map(de))}
        render.append(sid)
        n_short = sum(1 for s in sids if nwc(site['sents'][s]['de']) < 11)
        sids.insert(n_short, sid)   # own sentences go after the short Tatoeba ones, before the long ones
    for sid in sids:
        f, gp = hl_gp(k, sid)
        if not f: dropped.append((k, sid)); continue
        w['s'].append(sid); w['hl'].append(f); w['gp'].append(gp)
    if pos[k]: w['p'] = pos[k].most_common(1)[0][0]
    site['words'].append(w)
for w in site['words']:
    for sid in sel['add'].get(w['k'], []):
        f, gp = hl_gp(w['k'], sid)
        if not f: dropped.append((w['k'], sid)); continue
        w['s'].append(sid); w['hl'].append(f); w['gp'].append(gp)

# sentences nobody uses any more
usedS = {s for w in site['words'] for s in w['s']}
for sid in [s for s in render if s not in usedS]: del site['sents'][sid]
render = [s for s in render if s in usedS]
for s in site['sents'].values():
    if nwc(s['de']) >= 11: s['L'] = 1
    else: s.pop('L', None)

# ---------- Wiktionary: verb forms, comparison, cases (as lexicon_step2.py), tables (as make_forms.py) ----------
wk = collections.defaultdict(list)
for line in open(WK, encoding='utf-8'):
    d = json.loads(line); wk[d['word']].append(d)
def tags(f): return set(f.get('tags') or [])
def verb_forms(lem):
    for d in wk.get(lem, []):
        if d['pos'] != 'verb' or not d.get('forms'): continue
        out = {}
        for f in d['forms']:
            t = tags(f)
            if 'p3' not in out and {'present', 'singular', 'third-person'} <= t and 'subjunctive' not in t: out['p3'] = f['form']
            if 'pt' not in out and ({'preterite', 'singular', 'third-person'} <= t or t == {'past'}) and 'subjunctive' not in t: out['pt'] = f['form']
            if 'pp' not in out and {'participle', 'past'} <= t: out['pp'] = f['form']
            if 'auxiliary' in t and f['form'] in ('haben', 'sein') and f['form'] not in out.setdefault('aux', []): out['aux'].append(f['form'])
            if 'table-tags' in t: out['tt'] = f['form']
        if {'p3', 'pp'} <= set(out):
            out['st'] = 0 if out.get('tt') == 'weak' else 1
            out.pop('tt', None)
            if not out.get('aux'): out['aux'] = ['haben']
            return out
def adj_forms(lem):
    for d in wk.get(lem, []):
        if d['pos'] not in ('adj', 'adv') or not d.get('forms'): continue
        c = next((f['form'] for f in d['forms'] if tags(f) == {'comparative'}), None)
        s = next((f['form'] for f in d['forms'] if tags(f) == {'superlative'}), None)
        if c and s and s.startswith('am '): return [c, s]
CASE = {'außer': 'D', 'gemäß': 'D', 'entlang': 'A', 'angesichts': 'G', 'außerhalb': 'G', 'anhand': 'G', 'mittels': 'G',
        'anstatt': 'G', 'binnen': 'D', 'zufolge': 'D', 'namens': 'G'}
DROP_CMP = set('französisch englisch britisch türkisch italienisch chinesisch japanisch spanisch griechisch indisch ungarisch jüdisch katholisch '
               'weltweit möglichst menschlich finanziell wirtschaftlich wissenschaftlich gesetzlich medizinisch gesellschaftlich demokratisch '
               'theoretisch religiös traditionell automatisch elektrisch westlich nördlich tot leer vergangen kommend schade okay extra '
               'gratis null parallel sexuell geistig vereinigt lebend erwachsen ausländisch zuhause bloß ausschließlich regelmäßig vierter fünfter '
               'mittlerer sämtlicher unmöglich individuell lokal real unmittelbar ungefähr selbstverständlich hauptsächlich möglicherweise '
               'offensichtlich angeblich momentan anscheinend scheinbar definitiv letztlich künftig freiwillig zunehmend endgültig'.split())
nv = na = 0
for w in site['words'][-len(sel['new']):]:
    c, lem = w['k'].split(':', 1)
    if w['c'] == 'V':
        vf = verb_forms(lem)
        if vf: w['vf'] = vf; nv += 1
    if w['c'] == 'A' and lem not in DROP_CMP:
        cmp = adj_forms(lem)
        if cmp: w['cmp'] = cmp; na += 1
    if lem in CASE and w.get('p') == 'ADP': w['cs'] = CASE[lem]

P6 = {('first-person', 'singular'): 0, ('second-person', 'singular'): 1, ('third-person', 'singular'): 2,
      ('first-person', 'plural'): 3, ('second-person', 'plural'): 4, ('third-person', 'plural'): 5}
def slot(t):
    for (a, b), i in P6.items():
        if a in t and b in t: return i
AUX = {'haben': ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], 'sein': ['bin', 'bist', 'ist', 'sind', 'seid', 'sind']}
def verb_table(lem, aux):
    for d in wk.get(lem, []):
        if d['pos'] != 'verb' or not d.get('forms'): continue
        pr, pt, imp, pp = [None] * 6, [None] * 6, {}, None
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
        if not all(pr) or not pp: continue
        a = (aux or ['haben'])[0]
        e = {'pr': pr, 'pf': [AUX[a][i] + ' ' + pp for i in range(6)]}
        if all(pt): e['pt'] = pt
        if imp.get('du') and not imp['du'].startswith('-'):
            v3 = pr[5].split(' ', 1); sie = v3[0] + ' Sie ' + v3[1] if len(v3) > 1 else pr[5] + ' Sie'
            e['imp'] = [imp['du'] + '!', (imp.get('ihr') or pr[4]) + '!', sie + '!']
        if aux and len(aux) > 1: e['pf2'] = [AUX[aux[1]][i] + ' ' + pp for i in range(6)]
        return e
rows = {}
for row in csv.DictReader(open(NOUNS, encoding='utf-8')):
    if row['pos'] == 'Substantiv' and row['lemma'] not in rows: rows[row['lemma']] = row
def col(r, name): return r.get(name) or r.get(name + ' 1') or ''
NA = {'m': ['der', 'des', 'dem', 'den'], 'f': ['die', 'der', 'der', 'die'], 'n': ['das', 'des', 'dem', 'das']}
CASES = ['nominativ', 'genitiv', 'dativ', 'akkusativ']
def noun_table(wd, pl):
    lem = wd.split(' ', 1)[-1]; art = wd.split(' ', 1)[0] if ' ' in wd else ''
    g = {'der': 'm', 'die': 'f', 'das': 'n'}.get(art); r = rows.get(lem)
    if not r or not g: return None
    sg = [col(r, c + ' singular') for c in CASES]
    if not all(sg): return None
    e = {'sg': [NA[g][i] + ' ' + sg[i] for i in range(4)]}
    if pl:
        p = [col(r, c + ' plural') for c in CASES]
        if all(p) and p[0] == pl: e['pl'] = [['die', 'der', 'den', 'die'][i] + ' ' + p[i] for i in range(4)]
    return e
nf = 0
for w in site['words'][-len(sel['new']):]:
    if w['k'] in forms: continue
    e = verb_table(w['k'][2:], w['vf'].get('aux')) if w.get('vf') else noun_table(w['w'], w.get('pl')) if w['c'] == 'N' else None
    if e: forms[w['k']] = e; nf += 1
for k, x in ex.items():
    if k in forms: continue
    c, lem = k.split(':', 1)
    e = noun_table(x['w'], x.get('pl')) if c == 'N' else verb_table(lem, None) if lem in wk else None
    if e: forms[k] = e; nf += 1

site['v'] = 'x2000'
json.dump(site, open(wp, 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(forms, open(fp, 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(render, open(RL, 'w'))
print('words', len(site['words']), 'sentences', len(site['sents']), 'to render', len(render), 'ex', len(ex),
      '| verbs with forms', nv, 'adjectives with comparison', na, 'new tables', nf, '| dropped', len(dropped), dropped[:8])
print('per word', sorted(collections.Counter(len(w['s']) for w in site['words']).items()))
