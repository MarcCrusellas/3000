"""Step 2: merge token maps, gaps, POS, verb/adjective forms, preposition cases and the extra lexicon into words.json.
Usage: python3 -I lexicon_step2.py <build_dir> <wikt_subset.jsonl> <nouns_csv> <site_dir>"""
import csv, json, os, sys, collections
B, WK, NOUNS, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2], sys.argv[3], sys.argv[4]
lex = json.load(open(B + 'lex1.json'))
ranks = json.load(open(B + 'ranks.json'))
p = os.path.join(OUT, 'data', 'words.json')
site = json.load(open(p))
REMAP = {'N:Kannst': 'W:können', 'W:geh': 'W:gehen', 'W:komm': 'W:kommen', 'W:nimm': 'W:nehmen', 'W:lasst': 'W:lassen',
         'N:Gute': 'W:gut', 'N:Neue': 'W:neu', 'N:Lesen': 'W:lesen', 'W:welchenr': 'W:welcher', 'W:voller': 'W:voll',
         'W:öfter': 'W:oft', 'N:Vorsitzend': 'N:Vorsitzende'}
listkeys = {w['k'] for w in site['words']}
# token maps
for sid, m in lex['maps'].items():
    site['sents'][sid]['m'] = {s: REMAP.get(k, k) for s, k in m.items()}
# extra lexicon
gl = dict(l.rstrip('\n').split('\t') for l in open(B + 'extra_glosses.tsv', encoding='utf-8'))
nouns = {}
for row in csv.DictReader(open(NOUNS, encoding='utf-8')):
    if row['pos'] != 'Substantiv' or row['lemma'] in nouns: continue
    g = row.get('genus') or row.get('genus 1') or ''
    pl = row.get('nominativ plural') or row.get('nominativ plural 1') or ''
    nouns[row['lemma']] = (g, pl)
ART = {'m': 'der', 'f': 'die', 'n': 'das'}
ex = {}
used = set(k for m in lex['maps'].values() for k in m.values())
for k in sorted({REMAP.get(k, k) for k in used} - listkeys):
    if k not in gl: continue
    c, lem = k.split(':', 1)
    e = {'g': gl[k], 'r': ranks.get(k)}
    if c == 'N':
        g, pl = nouns.get(lem, ('', ''))
        e['w'] = (ART[g] + ' ' + lem) if g in ART else lem
        if pl and pl not in ('—', '-') and lem not in ('Weihnachten', 'Ausland', 'Fernsehen', 'Französisch', 'Milch', 'Reis', 'Respekt', 'Unsinn', 'Menschheit', 'Vergangenheit', 'Lob', 'Strom', 'Publikum', 'Unterricht', 'Wetter', 'Herbst'):
            e['pl'] = pl
        if lem == 'Lebensmittel': e['w'] = 'die Lebensmittel'
        if lem == 'Brille': e['w'] = 'die Brille'
    else:
        e['w'] = lem
    ex[k] = e
site['ex'] = ex
missing = sorted({REMAP.get(k, k) for k in used} - listkeys - set(ex))
print('extras', len(ex), 'without gloss:', missing[:20])
# wiktionary forms
wk = collections.defaultdict(list)
for line in open(WK, encoding='utf-8'):
    d = json.loads(line); wk[d['word']].append(d)
def tags(f): return set(f.get('tags') or [])
def verb_forms(lem):
    for d in wk.get(lem, []):
        if d['pos'] != 'verb' or not d.get('forms'): continue
        F = d['forms']; out = {}
        for f in F:
            t = tags(f)
            if 'p3' not in out and {'present', 'singular', 'third-person'} <= t and 'subjunctive' not in t: out['p3'] = f['form']
            if 'pt' not in out and ({'preterite', 'singular', 'third-person'} <= t or t == {'past'}) and 'subjunctive' not in t: out['pt'] = f['form']
            if 'pp' not in out and {'participle', 'past'} <= t: out['pp'] = f['form']
            if 'auxiliary' in t and f['form'] in ('haben', 'sein'): out.setdefault('aux', [])
            if 'auxiliary' in t and f['form'] in ('haben', 'sein') and f['form'] not in out['aux']: out['aux'].append(f['form'])
            if 'table-tags' in t: out['tt'] = f['form']
        if {'p3', 'pp'} <= set(out):
            out['st'] = 0 if out.get('tt') == 'weak' else 1
            out.pop('tt', None)
            out.setdefault('aux', ['haben'])
            return out
    return None
def adj_forms(lem):
    for d in wk.get(lem, []):
        if d['pos'] not in ('adj', 'adv') or not d.get('forms'): continue
        c = next((f['form'] for f in d['forms'] if tags(f) == {'comparative'}), None)
        s = next((f['form'] for f in d['forms'] if tags(f) == {'superlative'}), None)
        if c and s and s.startswith('am '): return [c, s]
    return None
CASE = {'aus': 'D', 'bei': 'D', 'mit': 'D', 'nach': 'D', 'seit': 'D', 'von': 'D', 'zu': 'D', 'gegenüber': 'D', 'ab': 'D',
        'durch': 'A', 'für': 'A', 'gegen': 'A', 'ohne': 'A', 'um': 'A', 'bis': 'A', 'per': 'A', 'pro': 'A',
        'an': 'W', 'auf': 'W', 'hinter': 'W', 'in': 'W', 'neben': 'W', 'über': 'W', 'unter': 'W', 'vor': 'W', 'zwischen': 'W',
        'während': 'G', 'wegen': 'G', 'statt': 'G', 'trotz': 'G', 'aufgrund': 'G', 'innerhalb': 'G', 'dank': 'G', 'laut': 'G'}
DROP_CMP = set('deutsch gerade wirklich natürlich eigentlich eben politisch rein öffentlich sozial europäisch zahlreich wahrscheinlich wert allgemein absolut fertig historisch unterschiedlich bereit los heutig russisch entfernt privat amerikanisch notwendig offenbar ursprünglich speziell nötig vollständig offiziell wesentlich verschieden voll praktisch direkt aktuell echt persönlich normal positiv aktiv rund wahr'.split())
AUX_FIX = {'aufstehen': ['sein'], 'passieren': ['sein'], 'bekommen': ['haben'], 'setzen': ['haben'], 'anfangen': ['haben'], 'anziehen': ['haben'],
           'fahren': ['sein', 'haben'], 'fliegen': ['sein', 'haben'], 'ziehen': ['haben', 'sein'], 'stehen': ['haben', 'sein'], 'liegen': ['haben', 'sein'],
           'sitzen': ['haben', 'sein'], 'starten': ['haben', 'sein'], 'treten': ['haben', 'sein']}
nv = na = 0
for w in site['words']:
    k = w['k']; c, lem = k.split(':', 1)
    w['gp'] = lex['gaps'].get(k)
    fp = lex['finepos'].get(k)
    if fp: w['p'] = fp
    if w['c'] == 'V':
        vf = verb_forms(lem)
        if vf:
            if lem in AUX_FIX: vf['aux'] = AUX_FIX[lem]
            w['vf'] = vf; nv += 1
    if w['c'] == 'A':
        cmp = adj_forms(lem)
        if cmp and lem not in DROP_CMP: w['cmp'] = cmp; na += 1
    if lem in CASE and w.get('p') == 'ADP': w['cs'] = CASE[lem]
nV = sum(1 for w in site['words'] if w['c'] == 'V')
print('verbs with forms', nv, 'of', nV, '| adjectives with comparison', na, '| prepositions', sum(1 for w in site['words'] if 'cs' in w))
print('verbs missing:', [w['k'] for w in site['words'] if w['c'] == 'V' and 'vf' not in w][:30])
print('sample:', [(w['k'], w.get('vf') or w.get('cmp') or w.get('cs')) for w in site['words'] if w['k'] in ('W:gehen', 'W:anfangen', 'W:haben', 'W:schnell', 'W:gut', 'W:in', 'W:bringen')])
site['v'] = 'rc2'
json.dump(site, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('size', os.path.getsize(p))
