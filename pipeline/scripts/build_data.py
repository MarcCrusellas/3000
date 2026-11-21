"""Build the ranked German word list and pick up to 3 sentences per word.

Usage: python3 -I build_data.py <tatoeba_dir> <nouns_csv> <out_dir> [n_words]
Outputs <out_dir>/parsed.pkl (cache), <out_dir>/words_raw.json, <out_dir>/report.txt
"""
import bz2, collections, csv, json, os, pickle, re, sys

D = sys.argv[1].rstrip('/') + '/'
NOUNS = sys.argv[2]
OUT = sys.argv[3]
NW = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
os.makedirs(OUT, exist_ok=True)

WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
BAD_CHARS = re.compile(r'[0-9"„“”«»()\[\]:;/–—…&%$€@#*_=+<>|~^]')
FUNC = {'DET', 'PRON', 'ADP', 'PART', 'CCONJ', 'SCONJ'}

def cls_of(pos):
    if pos == 'NOUN': return 'N'
    if pos in ('VERB', 'AUX'): return 'V'
    if pos in ('ADJ', 'ADV'): return 'A'
    if pos in FUNC: return 'F'
    if pos == 'NUM': return 'NUM'
    if pos == 'INTJ': return 'I'
    if pos == 'PROPN': return 'P'
    return 'X'

# ---------- load Tatoeba ----------
deu = {}
with bz2.open(D + 'deu_sentences_detailed.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        deu[int(p[0])] = p[2].strip()
spa_links = collections.defaultdict(list)
with bz2.open(D + 'deu-spa_links.tsv.bz2', 'rt') as f:
    for line in f:
        a, b = map(int, line.split('\t'))
        spa_links[a].append(b)
spa = {}
with bz2.open(D + 'spa_sentences.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        spa[int(p[0])] = p[2].strip()
audio = {}
with open(D + 'sentences_with_audio.csv', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        sid = int(p[0])
        if sid in deu and p[3] in ('CC BY 4.0', 'CC BY-NC 4.0') and sid not in audio:
            audio[sid] = {'id': int(p[1]), 'user': p[2], 'license': p[3]}

cands = []
for sid, text in deu.items():
    if sid not in spa_links or BAD_CHARS.search(text):
        continue
    n = len(WORD.findall(text))
    if 3 <= n <= 12:
        cands.append(sid)
cands.sort()
print('candidate German sentences with Spanish links:', len(cands), flush=True)

# ---------- parse (cached) ----------
cache = os.path.join(OUT, 'parsed.pkl')
if os.path.exists(cache):
    parsed = pickle.load(open(cache, 'rb'))
else:
    import spacy
    nlp = spacy.load('de_core_news_md', disable=['ner'])
    parsed = {}
    texts = [deu[s] for s in cands]
    for i, (sid, doc) in enumerate(zip(cands, nlp.pipe(texts, batch_size=400, n_process=2))):
        toks = []
        for t in doc:
            if t.is_punct or t.is_space:
                continue
            if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
                toks.append((t.text, 'SVP', t.lemma_.lower(), ''))
                continue
            lemma = t.lemma_
            svp = [c for c in t.children if c.dep_ == 'svp']
            if t.pos_ in ('VERB', 'AUX') and svp:
                lemma = svp[0].lemma_.lower() + lemma.lower()
            g = t.morph.get('Gender')
            toks.append((t.text, t.pos_, lemma, g[0] if g else ''))
        parsed[sid] = toks
        if i % 20000 == 0:
            print('parsed', i, flush=True)
    pickle.dump(parsed, open(cache, 'wb'))

LEMMA_FIX = {'mussen': 'müssen', 'muss': 'müssen', 'mussn': 'müssen', 'musst': 'müssen', 'müsst': 'müssen',
             'hab': 'haben', 'habn': 'haben', 'hast': 'haben', 'habt': 'haben', 'heisst': 'heißen', 'heißt': 'heißen',
             'lässt': 'lassen', 'lass': 'lassen', 'kannst': 'können', 'bist': 'sein', 'wirst': 'werden',
             'willst': 'wollen', 'wussen': 'wissen', 'weißt': 'wissen', 'eur': 'euer', 'aller': 'alle', 'all': 'alle',
             'vieler': 'viel', 'kannstn': 'können', 'viele': 'viel', 'einiger': 'einige', 'meister': 'meist', 'meisten': 'meist'}
NOUN_FIX = {'Danke': 'W:danke', 'Hab': 'W:haben', 'Halt': 'W:halt', 'Erster': 'W:erster',
            'Bisschen': 'W:bisschen', 'Schau': 'W:schauen', 'Deutsche': 'N:Deutsch'}
DROP = {'W:berliner'}

def key_of(tok):
    text, pos, lemma, _ = tok
    if pos == 'SVP':
        return None
    c = cls_of(pos)
    if c == 'N':
        lemma = lemma[:1].upper() + lemma[1:]
        return NOUN_FIX.get(lemma, 'N:' + lemma)
    if c in ('P', 'X'):
        return c + ':' + lemma
    lemma = LEMMA_FIX.get(lemma.lower(), lemma.lower())
    if lemma == 'sein' and c == 'F':
        return 'S:sein'
    return 'W:' + lemma

CLS_OF_KEY = collections.defaultdict(collections.Counter)

# ---------- frequency ranking ----------
from wordfreq import top_n_list, word_frequency
import simplemma
formdist = collections.defaultdict(collections.Counter)
keycount = collections.Counter()
gender = collections.defaultdict(collections.Counter)
for sid, toks in parsed.items():
    for tok in toks:
        k = key_of(tok)
        if k is None:
            continue
        formdist[tok[0].lower()][k] += 1
        keycount[k] += 1
        CLS_OF_KEY[k][cls_of(tok[1])] += 1
        if tok[3]:
            gender[k][tok[3]] += 1

lemfreq = collections.Counter()
for w in top_n_list('de', 60000):
    if not WORD.fullmatch(w):
        continue
    fq = word_frequency(w, 'de')
    dist = formdist.get(w)
    if dist:
        tot = sum(dist.values())
        for k, c in dist.items():
            lemfreq[k] += fq * c / tot
ranked = [k for k, _ in lemfreq.most_common()
          if k.split(':', 1)[0] in ('N', 'W', 'S')
          and k not in DROP
          and WORD.fullmatch(k.split(':', 1)[1])
          and keycount[k] >= 3
          and not k.split(':', 1)[1].isupper()
          and len(k.split(':', 1)[1]) > 1]
rank = {k: i + 1 for i, k in enumerate(ranked)}
print('ranked keys:', len(ranked), flush=True)

# ---------- nouns: gender + plural ----------
nouns = collections.defaultdict(list)
with open(NOUNS, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        nouns[row['lemma']].append((row['pos'], row.get('genus') or row.get('genus 1') or '',
                                    row.get('nominativ plural') or row.get('nominativ plural 1') or '',
                                    row.get('nominativ singular') or row.get('nominativ singular 1') or ''))
GENDER_FIX = {'Teil': 'm', 'Alter': 'n', 'Jugendliche': 'mf', 'Foto': 'n'}
NO_PLURAL = set('Polizei Musik Politik Zukunft Mai März April Juli Juni August Januar Februar September Oktober November Dezember '
                'Sport Druck Erde Natur Wirtschaft Gewalt Bildung Lust Sicht Schutz Bevölkerung Unterstützung Verfügung Freude '
                'Liebe Post Glück Geld Ruhe Nähe Dank Sex Gold Internet Deutsch Englisch Wasser Luft Energie Hilfe Sicherheit '
                'Kultur Kritik Gesellschaft Arbeit Zeit Welt Angst Kraft Macht Freiheit Hoffnung Wahrheit Ordnung Qualität'.split())

def noun_info(lemma, sp_gender):
    rows = nouns.get(lemma, [])
    pref = [r for r in rows if r[0] == 'Substantiv'] or rows
    if lemma in GENDER_FIX:
        g = GENDER_FIX[lemma]
        r = next((r for r in pref if r[1] == g), pref[0] if pref else ('', g, '', ''))
        return g, r[2]
    gs = []
    for r in pref:
        if r[1] and r[1] not in gs:
            gs.append(r[1])
    if len(gs) > 1 and sp_gender in gs:
        r = next(r for r in pref if r[1] == sp_gender)
        return r[1], r[2]
    if pref:
        r = next((r for r in pref if r[1]), pref[0])
        if not r[1] and not r[3] and r[2]:
            return 'pl', r[2]
        return (r[1] or sp_gender), r[2]
    return sp_gender, ''
ART = {'m': 'der', 'f': 'die', 'n': 'das', 'pl': 'die', 'mf': 'der/die'}
SPACY_G = {'Masc': 'm', 'Fem': 'f', 'Neut': 'n'}

# ---------- sentence selection ----------
by_key = collections.defaultdict(list)
for sid, toks in parsed.items():
    for k in {key_of(t) for t in toks}:
        if k in rank and rank[k] <= NW:
            by_key[k].append(sid)

def norm_words(text):
    return [w.lower() for w in WORD.findall(text)]

def is_dup(a, b):
    ca, cb = collections.Counter(a), collections.Counter(b)
    diff = sum(((ca - cb) + (cb - ca)).values())
    return diff <= 2

used = set()
words = []
report = collections.Counter()
for k in ranked[:NW]:
    r = rank[k]
    lim = max(r, 1000)
    scored = []
    for sid in by_key.get(k, ()):
        toks = parsed[sid]
        keys = [key_of(t) for t in toks]
        if any(t[1] in ('PROPN', 'X', 'SYM') for t in toks):
            continue
        others = [rank.get(x, 10**6) for x in keys if x is not None and x != k]
        if any(o >= 10**6 for o in others):
            continue
        n = len(norm_words(deu[sid]))
        over = [o for o in others if o > lim]
        if not over and n <= 10:
            tier = 0
        elif len(over) <= 1 and all(o <= 3000 for o in over) and n <= 12:
            tier = 1
        elif len(over) <= 2 and all(o <= 3000 for o in over) and n <= 12:
            tier = 2
        else:
            continue
        strict = 0 if all(o <= max(r, 300) for o in others) else 1
        native = 0 if sid in audio else 1
        scored.append((tier, sid in used, native, strict, n, sid))
    scored.sort()
    picked = []
    for tier, _, native, strict, n, sid in scored:
        w = norm_words(deu[sid])
        if any(is_dup(w, norm_words(deu[p])) for p in picked):
            continue
        picked.append(sid)
        if len(picked) == 3:
            break
    used.update(picked)
    c, lemma = k.split(':', 1)
    disp, pl, g = lemma, '', ''
    if c == 'N':
        spg = SPACY_G.get(gender[k].most_common(1)[0][0], '') if gender[k] else ''
        g, pl = noun_info(lemma, spg)
        disp = f"{ART[g]} {lemma}" if g in ART else lemma
        if lemma in NO_PLURAL:
            pl = ''
    else:
        mc = [x for x, _ in CLS_OF_KEY[k].most_common() if x not in ('N', 'P', 'X')]
        c = mc[0] if mc else 'A'
    sents = []
    for sid in picked:
        es_ids = sorted(spa_links[sid], key=lambda e: (len(spa.get(e, 'x' * 999)), e))
        es_ids = [e for e in es_ids if e in spa]
        es_txt = re.sub(r'([!?¡¿])\1+', r'\1', spa[es_ids[0]])
        sents.append({'sid': sid, 'de': deu[sid], 'es': es_txt, 'esid': es_ids[0],
                      'audio': audio.get(sid)})
    report[len(picked)] += 1
    words.append({'rank': r, 'key': k, 'cls': c, 'lemma': lemma, 'display': disp,
                  'gender': g, 'plural': pl if pl and pl not in ('—', '-') and g != 'pl' else '',
                  'sents': sents, 'tiers': [t for t, *_ in scored[:0]]})

json.dump(words, open(os.path.join(OUT, 'words_raw.json'), 'w'), ensure_ascii=False, indent=0)
json.dump({k: rank[k] for k in ranked[:5000]}, open(os.path.join(OUT, 'ranks.json'), 'w'), ensure_ascii=False)
nat = sum(1 for w in words for s in w['sents'] if s['audio'])
tot = sum(len(w['sents']) for w in words)
print('sentences per word:', dict(sorted(report.items())), 'total sentences', tot, 'native', nat)
