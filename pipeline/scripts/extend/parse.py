"""Parse every German Tatoeba sentence that has a Spanish translation (3 to 18 words) once, with spaCy.
Usage: python3 -I parse.py <tatoeba_dir> <out_pkl>
Writes {sid: {'toks': [(text, pos, lemma, gender)], 'm': {surface: key}}}.
'toks' uses build_data.py's format (particles as 'SVP'); 'm' is the token map the app shows (merge_sents.py's rules, no REMAP)."""
import bz2, collections, os, pickle, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.join(HERE, '..')]
from dekeys import key_of, LEMMA_FIX
D, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
BAD = re.compile(r'[0-9"„“”«»()\[\]:;/–—…&%$€@#*_=+<>|~^]')
deu = {}
with bz2.open(D + 'deu_sentences_detailed.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t'); deu[int(p[0])] = p[2].strip()
linked = set()
with bz2.open(D + 'deu-spa_links.tsv.bz2', 'rt') as f:
    for line in f: linked.add(int(line.split('\t')[0]))
cands = sorted(s for s in linked if s in deu and not BAD.search(deu[s]) and 3 <= len(WORD.findall(deu[s])) <= 18)
print('candidates', len(cands), flush=True)
import spacy
nlp = spacy.load('de_core_news_md', disable=['ner'])
out = {}
for i, (sid, doc) in enumerate(zip(cands, nlp.pipe((deu[s] for s in cands), batch_size=400, n_process=2))):
    toks, m = [], {}
    for t in doc:
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            toks.append((t.text, 'SVP', t.lemma_.lower(), ''))
            l = t.lemma_.lower() + t.head.lemma_.lower(); k = 'W:' + LEMMA_FIX.get(l, l)
        else:
            lemma = t.lemma_
            svp = [c for c in t.children if c.dep_ == 'svp']
            if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
            g = t.morph.get('Gender')
            toks.append((t.text, t.pos_, lemma, g[0] if g else ''))
            k = key_of((t.text, t.pos_, lemma, ''))
        if k and not k.startswith(('P:', 'X:')) and t.text not in m: m[t.text] = k
    out[sid] = {'toks': toks, 'm': m}
    if i % 20000 == 0: print('parsed', i, flush=True)
pickle.dump(out, open(OUT, 'wb'))
print('done', len(out))
