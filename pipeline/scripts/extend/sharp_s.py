"""wordfreq casefolds ß to ss, so build_data.py never matched words like Straße, Spaß or außerdem against Tatoeba and
left them out of ranks.json. This recomputes the frequency score the same way, matching casefolded forms, and
lists the ß words that would have been in the top N.
Usage: python3 -I sharp_s.py <parsed.pkl> <build_dir> <n> <out.json>"""
import collections, json, os, pickle, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.join(HERE, '..')]
from dekeys import key_of, DROP
from remap import REMAP
from wordfreq import top_n_list, word_frequency
P = pickle.load(open(sys.argv[1], 'rb')); B = sys.argv[2].rstrip('/') + '/'; N = int(sys.argv[3])
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
formdist = collections.defaultdict(collections.Counter); keycount = collections.Counter()
for x in P.values():
    for t in x['toks']:
        k = key_of(t)
        if not k: continue
        formdist[t[0].casefold()][k] += 1; keycount[k] += 1
lemfreq = collections.Counter()
for w in top_n_list('de', 60000):
    if not WORD.fullmatch(w): continue
    fq = word_frequency(w, 'de'); d = formdist.get(w)
    if d:
        tot = sum(d.values())
        for k, c in d.items(): lemfreq[k] += fq * c / tot
ranked = [k for k, _ in lemfreq.most_common() if k.split(':', 1)[0] in ('N', 'W', 'S') and k not in DROP
          and WORD.fullmatch(k.split(':', 1)[1]) and keycount[k] >= 3 and not k.split(':', 1)[1].isupper() and len(k.split(':', 1)[1]) > 1]
ranks = json.load(open(B + 'ranks.json'))
out = [(i + 1, k, lemfreq[k]) for i, k in enumerate(ranked[:N]) if 'ß' in k and k not in ranks and REMAP.get(k, k) == k]
print(len(out), out)
json.dump(out, open(sys.argv[4], 'w'), ensure_ascii=False)
