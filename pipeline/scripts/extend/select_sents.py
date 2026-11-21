"""Pick sentences for the new list words, top up old words that have fewer than 5, and add longer sentences to every word.

Usage: python3 -I select_sents.py <tatoeba_dir> <parsed.pkl> <build_dir> <words.json> <newwords.json> <out.json>

Rules (agreed 2026-11-19, ADD_WORDS.md step 2), with r = the word's place in the list:
  short sentences (3-12 words), 5 per word:
    tier 0: every other word comes before r in the list (the word is the only new one), at most 10 words
    tier 1: one later word, at most 500 places ahead
    tier 2: up to two later words from the list or the glossed extras
    tier 3: up to two later words, one of them outside the list but in the top 3000 (needs a gloss)
    each word keeps at least one tier-0 sentence when Tatoeba has one; native recordings first inside a tier
  long sentences (11-18 words), 2 per word, all 2000 words:
    at most two later words, from the list or the glossed extras; native recordings first
Sentence order in w.s: the short ones first (old ones keep their place), then the long ones."""
import bz2, collections, json, os, pickle, re, sys, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.join(HERE, '..')]
from dekeys import key_of, cls_of
from remap import REMAP
T, PK, B, SITE, NEW, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2], sys.argv[3].rstrip('/') + '/', sys.argv[4], sys.argv[5], sys.argv[6]
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
PART = ('an', 'auf', 'aus', 'ein', 'mit', 'vor', 'zu', 'ab', 'nach', 'weg', 'zurück', 'los', 'fest', 'her', 'hin', 'heraus', 'hinaus',
        'vorbei', 'statt', 'teil', 'fern', 'bei', 'um', 'durch', 'über', 'unter', 'wieder')

P = pickle.load(open(PK, 'rb'))
deu, spa, links = {}, {}, collections.defaultdict(list)
with bz2.open(T + 'deu_sentences_detailed.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if int(p[0]) in P: deu[int(p[0])] = p[2].strip()
with bz2.open(T + 'deu-spa_links.tsv.bz2', 'rt') as f:
    for line in f:
        a, b = map(int, line.split('\t'))
        if a in P: links[a].append(b)
need_es = {b for v in links.values() for b in v}
with bz2.open(T + 'spa_sentences.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if int(p[0]) in need_es: spa[int(p[0])] = p[2].strip()
native = set()
for line in open(T + 'sentences_with_audio.csv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) > 3 and p[0].isdigit() and int(p[0]) in P and p[3].strip().startswith('CC BY'): native.add(int(p[0]))

site = json.load(open(SITE)); new = json.load(open(NEW)); ranks = json.load(open(B + 'ranks.json'))
gl2 = {}
for line in open(B + 'glosses_es_2.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t'); gl2[p[0]] = p[1]
LR = {w['k']: w['r'] for w in site['words']}
for e in new: LR[e['k']] = e['r']
GL = {w['k']: w['g'] for w in site['words']}; GL.update(gl2)
EX = {k: v for k, v in site['ex'].items() if k not in LR}
# glossed words that are not list words (fell off the end of the list, or glossed later as extras) count as extras
for k in gl2:
    if k not in LR: EX[k] = {'g': gl2[k]}
if os.path.exists(B + 'extra_glosses_2.tsv'):
    for line in open(B + 'extra_glosses_2.tsv', encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if p[0] not in LR: EX[p[0]] = {'g': p[1]}

# common names and places are fine in a sentence (Tatoeba is full of Tom and Maria); other proper nouns are not
NAMES = set('''Tom Toms Maria Marias Mary Marys John Johns Ken Bill Bob Jane Jim Jack Tony Betty Paul Peter Mike Marie Thomas Juan
Johannes Liisa Anna Lisa Emily Alice Japan Japans Boston Deutschland Deutschlands Paris Frankreich London Amerika China Tokio Tokyo
Spanien Italien Europa England Australien USA Kanada Brasilien Rom Kyoto Indien Osaka Russland Afrika Berlin Mexiko Schweiz Hawaii
Österreich Wien München Hamburg Madrid Barcelona Kalifornien'''.split())

def keys_of(sid):
    ks = []
    for t in P[sid]['toks']:
        k = key_of(t)
        if k and not k.startswith(('P:', 'X:')): ks.append(REMAP.get(k, k))
    return ks
def nwords(text): return [w.lower() for w in WORD.findall(text)]
def strip(s): return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
def heads(g):
    out = []
    for v in re.split(r'[,;/]', re.sub(r'\([^)]*\)', '', g)):
        ws = [w for w in re.findall(r'[a-záéíóúñü]+', v.lower()) if w not in ('el', 'la', 'los', 'las', 'un', 'una', 'de', 'a', 'se', 'lo')]
        if ws: out.append(strip(ws[0]))
    return out
def literal(g, es):
    t = strip(es); toks = re.findall(r'[a-zñ]+', t)
    for h in heads(g):
        if len(h) <= 3:
            if h in toks: return True
        elif h[:max(4, len(h) - 2)] in t: return True
    return False
def es_of(sid):
    ids = sorted([e for e in links[sid] if e in spa], key=lambda e: (len(spa[e]), e))
    return re.sub(r'([!?¡¿])\1+', r'\1', spa[ids[0]]) if ids else None
def dup(a, b):
    ca, cb = collections.Counter(a), collections.Counter(b)
    return sum(((ca - cb) + (cb - ca)).values()) <= max(2, round(0.4 * min(len(a), len(b))))
def tmap(sid):
    return {s: REMAP.get(k, k) for s, k in P[sid]['m'].items()}

# candidate sentences per key
by_key = collections.defaultdict(list)
ok_sent = {}
for sid, x in P.items():
    if any(t[1] in ('X', 'SYM') or (t[1] == 'PROPN' and t[0] not in NAMES) for t in x['toks']) or sid not in links: continue
    ks = keys_of(sid)
    ok_sent[sid] = ks
    for k in set(ks):
        if k in LR: by_key[k].append(sid)

def classify(k, r, sid):
    """unknown words of sentence sid for word k at list place r: list of (key, kind) or None if unusable."""
    unk = []
    for o in set(ok_sent[sid]):
        if o == k: continue
        lr = LR.get(o)
        if lr is not None:
            if lr > r: unk.append((o, 'L', lr))
        elif o in EX: unk.append((o, 'E', 0))
        elif ranks.get(o, 10 ** 6) <= 3000: unk.append((o, 'G', ranks[o]))
        else: return None
    return unk

existing_t = {s['t'] for s in site['sents'].values() if 't' in s}
used = collections.Counter(existing_t)
need_gloss = collections.Counter()
result_new, result_add, sents_new, stats = [], {}, {}, collections.Counter()

def short_pick(k, r, have_sids, have_texts, n_want, g):
    sc = []
    for sid in by_key.get(k, ()):
        if sid in have_sids: continue
        n = len(nwords(deu[sid]))
        if not 3 <= n <= 12: continue
        unk = classify(k, r, sid)
        if unk is None: continue
        if not unk and n <= 10: tier = 0
        elif len(unk) == 1 and unk[0][1] == 'L' and unk[0][2] <= r + 500: tier = 1
        elif len(unk) <= 2 and all(u[1] in 'LE' for u in unk): tier = 2
        elif len(unk) <= 2: tier = 3
        elif len(unk) == 3 and all(u[1] in 'LE' for u in unk) and n <= 10: tier = 4
        else: continue
        es = es_of(sid)
        if not es: continue
        if k not in tmap(sid).values(): continue
        sc.append((tier, used[sid] > 0, sid not in native, not literal(g, es), abs(n - 7), sid, es, unk))
    sc.sort()
    picked, texts = [], list(have_texts)
    # one tier-0 sentence first, if there is one
    order = [x for x in sc if x[0] == 0][:1] + sc
    for x in order:
        sid = x[5]
        if sid in [p[5] for p in picked]: continue
        w = nwords(deu[sid])
        if any(dup(w, h) for h in texts): continue
        picked.append(x); texts.append(w)
        if len(picked) == n_want: break
    return picked, texts

def long_pick(k, r, have_sids, texts, g):
    sc = []
    for sid in by_key.get(k, ()):
        if sid in have_sids: continue
        n = len(nwords(deu[sid]))
        if not 11 <= n <= 18: continue
        unk = classify(k, r, sid)
        if unk is None or len(unk) > 3 or sum(u[1] == 'G' for u in unk) > 1: continue
        es = es_of(sid)
        if not es or k not in tmap(sid).values(): continue
        sc.append((len(unk) > 1 and sid not in native, len(unk) > 2, sid not in native, len(unk), used[sid] > 0, not literal(g, es), abs(n - 14), sid, es, unk))
    sc.sort()
    picked = []
    for x in sc:
        w = nwords(deu[x[-3]])
        if any(dup(w, h) for h in texts): continue
        picked.append(x); texts.append(w)
        if len(picked) == 2: break
    return picked

def add_sent(sid, es, long):
    key = 't%d' % sid
    if key not in site['sents'] and key not in sents_new:
        sents_new[key] = {'de': deu[sid], 'es': es, 't': sid, 'm': tmap(sid), 'L': 1 if long else 0, 'nat': sid in native}
    used[sid] += 1
    return key

# new words
for e in new:
    k, r = e['k'], e['r']; g = GL[k]
    picked, texts = short_pick(k, r, set(), [], 5, g)
    longs = long_pick(k, r, {p[5] for p in picked}, texts, g)
    for x in picked:
        for u in x[7]:
            if u[1] == 'G': need_gloss[u[0]] += 1
    stats['new_short_%d' % len(picked)] += 1; stats['new_long_%d' % len(longs)] += 1
    stats['new_tier0'] += any(x[0] == 0 for x in picked)
    for x in longs:
        for u in x[-1]:
            if u[1] == 'G': need_gloss[u[0]] += 1
    s = [add_sent(x[5], x[6], False) for x in picked] + [add_sent(x[-3], x[-2], True) for x in longs]
    # words still short of sentences get sentences written for the project (supplement_2.tsv, added by merge.py): at least 2 short, 3 in all
    sup = max(2 - len(picked), 3 - len(s), 0)
    stats['sup'] += sup
    result_new.append({'r': r, 'k': k, 's': s, 'sup': sup})

# old words: top up to 5 short, then 2 long
for w in site['words']:
    k, r = w['k'], w['r']; g = w['g']
    have = {site['sents'][s]['t'] for s in w['s'] if 't' in site['sents'][s]}
    texts = [nwords(site['sents'][s]['de']) for s in w['s']]
    add = []
    if len(w['s']) < 5:
        picked, texts = short_pick(k, r, have, texts, 5 - len(w['s']), g)
        for x in picked:
            for u in x[7]:
                if u[1] == 'G': need_gloss[u[0]] += 1
        add += [add_sent(x[5], x[6], False) for x in picked]
        have |= {x[5] for x in picked}
        stats['old_topup'] += len(picked)
    longs = long_pick(k, r, have, texts, g)
    stats['old_long_%d' % len(longs)] += 1
    for x in longs:
        for u in x[-1]:
            if u[1] == 'G': need_gloss[u[0]] += 1
    add += [add_sent(x[-3], x[-2], True) for x in longs]
    if add: result_add[k] = add

print(dict(sorted(stats.items())))
print('new sentences', len(sents_new), 'long', sum(s['L'] for s in sents_new.values()), 'native', sum(s['nat'] for s in sents_new.values()))
print('keys to gloss', len(need_gloss))
json.dump({'new': result_new, 'add': result_add, 'sents': sents_new, 'need_gloss': need_gloss.most_common()},
          open(OUT, 'w'), ensure_ascii=False)
