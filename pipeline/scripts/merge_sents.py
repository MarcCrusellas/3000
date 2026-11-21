"""Merge add_sents.json into words.json: new sentence entries with token maps, per-word highlight + gap forms, new extras.
Usage: python3 -I merge_sents.py <build_dir> <nouns_csv> <site_words_json> <render_list_out>"""
import csv, json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dekeys import key_of, LEMMA_FIX
B, NOUNS, SITE, RL = sys.argv[1].rstrip('/') + '/', sys.argv[2], sys.argv[3], sys.argv[4]
add = json.load(open(B + 'add_sents.json'))['add']
site = json.load(open(SITE))
ranks = json.load(open(B + 'ranks.json'))
REMAP = {'N:Kannst': 'W:können', 'W:geh': 'W:gehen', 'W:komm': 'W:kommen', 'W:nimm': 'W:nehmen', 'W:lasst': 'W:lassen',
         'N:Gute': 'W:gut', 'N:Neue': 'W:neu', 'N:Lesen': 'W:lesen', 'W:welchenr': 'W:welcher', 'W:voller': 'W:voll',
         'W:öfter': 'W:oft', 'N:Vorsitzend': 'N:Vorsitzende', 'W:brauchsen': 'W:brauchen', 'W:könnsten': 'W:können',
         'W:sprich': 'W:sprechen', 'W:sag': 'W:sagen', 'W:solltest': 'W:sollen', 'W:könntest': 'W:können',
         'N:Tausend': 'W:tausend', 'W:schick': 'W:schicken'}
listk = {w['k'] for w in site['words']}
ex = site['ex']
gl = dict(l.rstrip('\n').split('\t') for l in open(B + 'extra_glosses2.tsv', encoding='utf-8'))
nouns = {}
for row in csv.DictReader(open(NOUNS, encoding='utf-8')):
    if row['pos'] != 'Substantiv' or row['lemma'] in nouns: continue
    nouns[row['lemma']] = (row.get('genus') or row.get('genus 1') or '', row.get('nominativ plural') or row.get('nominativ plural 1') or '')
ART = {'m': 'der', 'f': 'die', 'n': 'das'}
NOPL = {'Tee', 'Gras', 'Bewusstsein', 'Physik', 'Gesundheit', 'Aufmerksamkeit', 'Güte', 'Schnee', 'Salz', 'Leid', 'Gegenwart', 'Rauchen', 'Verantwortung', 'Werbung', 'Forschung', 'Verbreitung', 'Freundschaft'}
import spacy
nlp = spacy.load('de_core_news_md', disable=['ner'])
PART = ('an', 'auf', 'aus', 'ein', 'mit', 'vor', 'zu', 'ab', 'nach', 'weg', 'zurück', 'los', 'fest', 'her', 'hin', 'heraus', 'hinaus', 'vorbei', 'statt', 'teil', 'fern', 'bei', 'um', 'durch', 'über', 'unter', 'wieder')

def mapping(doc):
    m = {}
    for t in doc:
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            l = t.lemma_.lower() + t.head.lemma_.lower(); k = 'W:' + LEMMA_FIX.get(l, l)
        else:
            lemma = t.lemma_
            svp = [c for c in t.children if c.dep_ == 'svp']
            if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
            k = key_of((t.text, t.pos_, lemma, ''))
        if not k or k.startswith(('P:', 'X:')): continue
        k = REMAP.get(k, k)
        if k not in listk and k not in ex:
            if k not in gl: continue
            c, lem = k.split(':', 1); e = {'g': gl[k], 'r': ranks.get(k), 'w': lem}
            if c == 'N':
                g, pl = nouns.get(lem, ('', ''))
                if g in ART: e['w'] = ART[g] + ' ' + lem
                if pl and pl not in ('—', '-') and lem not in NOPL: e['pl'] = pl
            ex[k] = e
        if t.text not in m: m[t.text] = k
    return m

new = {}
for k, lst in add.items():
    for x in lst:
        sid = 't%d' % x['tid']
        if sid not in site['sents'] and sid not in new: new[sid] = x
docs = dict(zip(new, nlp.pipe([x['de'] for x in new.values()], batch_size=200)))
render, added, dropped = [], 0, []
for sid, x in new.items():
    site['sents'][sid] = {'de': x['de'], 'es': x['es'], 'a': {}, 't': x['tid'], 'm': mapping(docs[sid])}
    render.append({'id': sid, 'de': x['de'], 'es': x['es']})
for w in site['words']:
    for x in add.get(w['k'], []):
        sid = 't%d' % x['tid']; m = site['sents'][sid]['m']
        forms = sorted(s for s, kk in m.items() if kk == w['k'])
        if not forms: dropped.append((w['k'], x['de'])); continue
        verbs = [f for f in forms if f.lower() not in PART]
        w['s'].append(sid); w['hl'].append(forms); w['gp'].append((verbs or forms)[0]); added += 1
render = [r for r in render if any(r['id'] in w['s'] for w in site['words'])]
for sid in [s for s in new if not any(s in w['s'] for w in site['words'])]: del site['sents'][sid]
print('added', added, 'render', len(render), 'dropped', len(dropped), dropped[:10], 'extras now', len(ex))
print('per word', collections.Counter(len(w['s']) for w in site['words']))
json.dump(site, open(SITE, 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(render, open(RL, 'w'), ensure_ascii=False)
