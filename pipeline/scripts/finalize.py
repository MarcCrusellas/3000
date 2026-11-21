"""Merge Tatoeba picks, Claude-written supplements and glosses into final.json.
Usage: python3 -I finalize.py <build_dir>
"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dekeys import key_of, cls_of
import spacy
B = sys.argv[1].rstrip('/') + '/'
words = json.load(open(B + 'words_raw.json'))
ranks = json.load(open(B + 'ranks.json'))
sup = json.load(open(B + 'supplement.json'))
gl = {}
for line in open(B + 'glosses_es.tsv', encoding='utf-8'):
    r, lem, g = line.rstrip('\n').split('\t')
    gl[int(r)] = (lem, g)
nlp = spacy.load('de_core_news_md', disable=['ner'])

def analyse(text):
    toks = []
    for t in nlp(text):
        if t.is_punct or t.is_space:
            continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            toks.append((t.text, 'SVP', t.lemma_.lower(), ''))
            continue
        lemma = t.lemma_
        svp = [c for c in t.children if c.dep_ == 'svp']
        if t.pos_ in ('VERB', 'AUX') and svp:
            lemma = svp[0].lemma_.lower() + lemma.lower()
        toks.append((t.text, t.pos_, lemma, ''))
    return toks

problems = []
cid = 0
out_words, sentences = [], {}
for w in words:
    k = w['key']
    lem, g = gl[w['rank']]
    if lem != w['lemma']:
        problems.append(f"gloss mismatch at {w['rank']}: {lem} vs {w['lemma']}")
    sents = []
    s_sup = sup.get(k, {})
    tlist = w['sents']
    if s_sup.get('drop_all'):
        tlist = []
    if 'keep_first' in s_sup:
        tlist = tlist[:s_sup['keep_first']]
    tlist = [s for s in tlist if s['de'] not in s_sup.get('drop_de', [])]
    for s in tlist:
        sid = f"t{s['sid']}"
        sentences[sid] = {'id': sid, 'de': s['de'], 'es': s['es'], 'src': 'tatoeba', 'tid': s['sid'], 'esid': s['esid'],
                          'audio': s['audio']}
        sents.append(sid)
    for de, es in s_sup.get('add', []):
        if len(sents) >= 3:
            break
        toks = analyse(de)
        keys = [key_of(t) for t in toks]
        lemma = k.split(':', 1)[1]
        hit = k in keys or any(t[1] == 'SVP' and t[2] == lemma.lower() for t in toks)
        others = [ranks.get(x, 99999) for x in keys if x and x != k]
        over = [(x, ranks.get(x, 99999)) for x in keys if x and x != k and ranks.get(x, 99999) > 1000]
        if not hit or any(o > 3000 for o in others) or len(over) > 1 or any(t[1] == 'PROPN' for t in toks):
            problems.append(f"{k}: '{de}' hit={hit} over={over} {[t[1] for t in toks if t[1]=='PROPN']}")
        cid += 1
        sid = f"c{cid}"
        sentences[sid] = {'id': sid, 'de': de, 'es': es, 'src': 'claude', 'audio': None}
        sents.append(sid)
    disp = w['display']
    out_words.append({'r': w['rank'], 'k': k, 'c': w['cls'], 'w': disp, 'pl': w['plural'], 'g': g, 's': sents})
print('\n'.join(problems) or 'no problems')
print('words', len(out_words), 'sentences', len(sentences), 'per-word', collections.Counter(len(x['s']) for x in out_words))
json.dump({'words': out_words, 'sentences': sentences}, open(B + 'final.json', 'w'), ensure_ascii=False)
