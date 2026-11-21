"""Step 1: per-sentence token->key maps, gap forms, fine POS, and the set of lemma keys outside the 1000 list.
Usage: python3 -I lexicon_step1.py <build_dir> <site_dir>
Writes <build_dir>/lex1.json
"""
import json, os, pickle, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dekeys import key_of, cls_of
B, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
parsed = pickle.load(open(B + 'parsed.pkl', 'rb'))
final = json.load(open(B + 'final.json'))
site = json.load(open(os.path.join(OUT, 'data', 'words.json')))
ranks = json.load(open(B + 'ranks.json'))
import spacy
nlp = spacy.load('de_core_news_md', disable=['ner'])
TOK = re.compile(r"(?:[^\W\d_]|['-])+")

def analyse(text):
    out = []
    for t in nlp(text):
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            hl = t.head.lemma_
            out.append((t.text, 'SVP', t.lemma_.lower(), '', t.lemma_.lower() + hl.lower())); continue
        lemma = t.lemma_
        svp = [c for c in t.children if c.dep_ == 'svp']
        if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
        out.append((t.text, t.pos_, lemma, ''))
    return out

# all sentences get a fresh parse so particles know their verb (cached parse lacks the head link)
sents = final['sentences']
texts = [(sid, s['de']) for sid, s in sents.items()]
maps, finepos = {}, collections.defaultdict(collections.Counter)
listkeys = {w['k'] for w in site['words']}
extra = collections.Counter()
for (sid, text), doc in zip(texts, nlp.pipe([t for _, t in texts], batch_size=200)):
    m = {}
    for t in doc:
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            k = 'W:' + t.lemma_.lower() + t.head.lemma_.lower()
            from dekeys import LEMMA_FIX
            k = 'W:' + LEMMA_FIX.get(k[2:], k[2:])
        else:
            lemma = t.lemma_
            svp = [c for c in t.children if c.dep_ == 'svp']
            if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
            k = key_of((t.text, t.pos_, lemma, ''))
            if k and not k.startswith(('P:', 'X:')):
                finepos[k][t.pos_] += 1
        if not k or k.startswith(('P:', 'X:')): continue
        # client splits on letters, apostrophes and hyphens: keep the surface as-is
        if t.text not in m: m[t.text] = k
        if k not in listkeys: extra[k] += 1
    maps[sid] = m
# gap form per (word, sentence): first token whose key is the word's key and is not a particle
gaps = {}
for w in site['words']:
    g = []
    for sid in w['s']:
        cand = [s for s, k in maps[sid].items() if k == w['k']]
        verbs = [c for c in cand if c[0].isalpha() and c.lower() not in ('an', 'auf', 'aus', 'ein', 'mit', 'vor', 'zu', 'ab', 'nach', 'weg', 'zurück', 'los', 'fest', 'her', 'hin', 'heraus', 'hinaus', 'vorbei', 'statt', 'teil', 'fern', 'bei', 'um', 'durch', 'über', 'unter', 'wieder')]
        g.append((verbs or cand or [''])[0])
    gaps[w['k']] = g
print('extra keys:', len(extra), 'top:', extra.most_common(15))
json.dump({'maps': maps, 'gaps': gaps, 'finepos': {k: c.most_common(1)[0][0] for k, c in finepos.items()},
           'extra': {k: ranks.get(k) for k in extra}}, open(B + 'lex1.json', 'w'), ensure_ascii=False)
