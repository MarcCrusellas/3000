"""Pick example sentences (native audio + Spanish translation, short, easy) for a sample loop.
Usage: python3 -I pick_examples.py <tatoeba_dir> lemma1 lemma2 ...
"""
import bz2, collections, re, sys
import simplemma
from wordfreq import top_n_list, word_frequency

D = sys.argv[1].rstrip('/') + '/'
targets = sys.argv[2:]
TOK = re.compile(r"[A-Za-zÄÖÜäöüß]+")
lemfreq = collections.Counter()
for w in top_n_list('de', 30000):
    if TOK.fullmatch(w):
        lemfreq[simplemma.lemmatize(w, lang='de').lower()] += word_frequency(w, 'de')
rank = {l: i + 1 for i, (l, _) in enumerate(lemfreq.most_common())}

audio = {}
with open(D + 'sentences_with_audio.csv', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if p[3] in ('CC BY 4.0', 'CC BY-NC 4.0'):
            audio.setdefault(int(p[0]), (p[1], p[2], p[3]))
deu = {}
with bz2.open(D + 'deu_sentences_detailed.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        sid = int(p[0])
        if sid in audio:
            deu[sid] = p[2]
spa_links = collections.defaultdict(list)
with bz2.open(D + 'deu-spa_links.tsv.bz2', 'rt') as f:
    for line in f:
        a, b = map(int, line.split('\t'))
        if a in deu:
            spa_links[a].append(b)
need = {b for v in spa_links.values() for b in v}
spa = {}
with bz2.open(D + 'spa_sentences.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if int(p[0]) in need:
            spa[int(p[0])] = p[2]

for t in targets:
    cands = []
    for sid, text in deu.items():
        if sid not in spa_links:
            continue
        toks = TOK.findall(text)
        if not 4 <= len(toks) <= 8:
            continue
        lems = [simplemma.lemmatize(x, lang='de').lower() for x in toks]
        if t not in lems or any(x in ('tom', 'maria', 'mary') for x in lems):
            continue
        diff = max([rank.get(l, 99999) for l in lems if l != t] or [0])
        cands.append((diff, len(toks), sid))
    cands.sort()
    print(f'== {t} (rank {rank.get(t)}) candidates: {len(cands)}')
    for diff, n, sid in cands[:4]:
        aid, user, lic = audio[sid]
        print(f'  #{sid} diff={diff} | {deu[sid]} | ES: {spa[spa_links[sid][0]]} | audio {aid} by {user} ({lic})')
