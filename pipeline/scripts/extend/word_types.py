"""Give every list word and extra a word type for the Palabras filter: t = n (noun), v (verb), a (adjective),
d (adverb), g (grammar: articles, pronouns, prepositions, conjunctions, numbers, particles, interjections).
spaCy tags most predicative adjectives as adverbs ("Das ist gut"), so adjective vs adverb comes from Wiktionary:
a word with an adjective entry there is an adjective, unless it also has an adverb entry and is used as an adverb
(no comparison forms and never tagged ADJ): ganz, wirklich, natürlich... count as adverbs, gut and schnell as adjectives. Run it after merge.py; it only adds the "t" field.
Usage: python3 -I word_types.py <kaikki-German.jsonl> <site_dir>"""
import collections, json, os, sys
KK, SITE = sys.argv[1], sys.argv[2]
p = os.path.join(SITE, 'data', 'words.json'); site = json.load(open(p))
want = {w['k'].split(':', 1)[1] for w in site['words']} | {k.split(':', 1)[1] for k in site['ex']}
pos = collections.defaultdict(set)
with open(KK, encoding='utf-8') as f:
    for line in f:
        d = json.loads(line)
        if d.get('word') in want and d.get('lang_code', 'de') == 'de': pos[d['word']].add(d.get('pos'))
GRAM = {'ADP', 'PRON', 'DET', 'CCONJ', 'SCONJ', 'NUM', 'PART', 'INTJ', 'AUX'}
WK_G = {'prep', 'pron', 'det', 'conj', 'num', 'particle', 'intj', 'article', 'postp', 'contraction'}
# hand fixes where both sources are unhelpful
FIX = {'W:ja': 'g', 'W:nein': 'g', 'W:nicht': 'g', 'W:zu': 'g', 'W:bitte': 'd', 'W:okay': 'g', 'W:sodass': 'g',
       'W:sehr': 'd', 'W:gern': 'd', 'W:oft': 'd', 'W:bald': 'd', 'W:mehr': 'd', 'W:weniger': 'd', 'W:viel': 'g', 'W:wenig': 'g',
       'W:leid': 'a', 'W:schade': 'a', 'W:weh': 'a', 'W:recht': 'a',
       'W:erster': 'g', 'W:zweiter': 'g', 'W:dritter': 'g', 'W:vierter': 'g', 'W:fünfter': 'g', 'W:genug': 'g',
       'W:direkt': 'a', 'W:voll': 'a', 'W:egal': 'a', 'W:persönlich': 'a', 'W:normal': 'a', 'W:nötig': 'a', 'W:kostenlos': 'a',
       'W:einzeln': 'a', 'W:täglich': 'a', 'W:unmöglich': 'a', 'W:regelmäßig': 'a', 'W:selten': 'a', 'W:halb': 'a',
       'W:gemeinsam': 'a', 'W:rein': 'a', 'W:extrem': 'a', 'W:absolut': 'a', 'W:total': 'a', 'W:offensichtlich': 'a',
       'W:gratis': 'a', 'W:gegenseitig': 'a', 'W:zufällig': 'a', 'W:erheblich': 'a', 'W:künftig': 'a',
       'W:betreten': 'v', 'W:geraten': 'v', 'W:gefallen': 'v', 'W:hersein': 'v', 'W:wütend': 'a', 'W:angemessen': 'a',
       'W:ausgezeichnet': 'a', 'W:bitter': 'a', 'W:gemein': 'a', 'W:neugierig': 'a', 'W:schief': 'a', 'W:konkret': 'a',
       'W:gewöhnlich': 'a', 'W:wieviel': 'g', 'W:zwanzig': 'g'}
def wtype(k, c=None, p=None, cmp=False):
    if k in FIX: return FIX[k]
    cl, lem = k.split(':', 1); wp = pos.get(lem, set())
    if cl == 'N': return 'n'
    if c == 'V' or (c is None and 'verb' in wp and not wp & {'adj', 'adv'}): return 'v'
    if c in ('F', 'NUM', 'I') or (c is None and wp and wp <= WK_G | {'adv'} and wp & WK_G): return 'g'
    if 'adj' in wp and ('adv' not in wp or cmp or p == 'ADJ'): return 'a'
    if p in GRAM and not wp & {'adv'}: return 'g'
    if 'adv' in wp or c == 'A': return 'd'
    return 'g' if wp & WK_G else 'd'
for w in site['words']: w['t'] = wtype(w['k'], w['c'], w.get('p'), 'cmp' in w)
for k, e in site['ex'].items(): e['t'] = wtype(k)
json.dump(site, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
c = collections.Counter(w['t'] for w in site['words']); print('list', dict(c), '| extras', dict(collections.Counter(e['t'] for e in site['ex'].values())))
