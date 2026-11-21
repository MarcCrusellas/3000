"""Add per-sentence highlight forms and single-word audio (pack 10) to words.json.
Usage: python3 -I add_extras.py <build_dir> <voices_dir> <site_dir>"""
import json, os, pickle, re, sys, io, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dekeys import key_of
import numpy as np
B, V, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/', sys.argv[3]
src = sys.argv[0].replace('add_extras.py', 'render.py')
ns = {}
code = open(src).read().split("if ROLE == 'pack':")[0].replace("ROLE = sys.argv[1]\nB = sys.argv[2].rstrip('/') + '/'", "")
exec(compile(code, 'render', 'exec'), ns)
parsed = pickle.load(open(B + 'parsed.pkl', 'rb'))
final = json.load(open(B + 'final.json'))
site = json.load(open(os.path.join(OUT, 'data', 'words.json')))
import spacy
nlp = spacy.load('de_core_news_md', disable=['ner'])

def toks_for(sid):
    s = final['sentences'][sid]
    if s['src'] == 'tatoeba' and s['tid'] in parsed:
        return parsed[s['tid']]
    out = []
    for t in nlp(s['de']):
        if t.is_punct or t.is_space: continue
        if t.dep_ == 'svp' and t.head.pos_ in ('VERB', 'AUX') and t.head.i != t.i:
            out.append((t.text, 'SVP', t.lemma_.lower(), '')); continue
        lemma = t.lemma_
        svp = [c for c in t.children if c.dep_ == 'svp']
        if t.pos_ in ('VERB', 'AUX') and svp: lemma = svp[0].lemma_.lower() + lemma.lower()
        out.append((t.text, t.pos_, lemma, ''))
    return out

miss = 0
for w in site['words']:
    k, lem = w['k'], w['k'].split(':', 1)[1].lower()
    hl = []
    for sid in w['s']:
        toks = toks_for(sid)
        forms = [t[0] for t in toks if key_of(t) == k]
        if forms:
            forms += [t[0] for t in toks if t[1] == 'SVP' and lem.startswith(t[2]) and t[2] != lem]
        else:
            forms = [t[0] for t in toks if t[0].lower().startswith(lem[:max(3, len(lem) - 2)])] or [t[0] for t in toks if t[1] == 'SVP' and t[2] == lem]
        if not forms: miss += 1
        hl.append(sorted(set(forms)))
    w['hl'] = hl
print('sentences without highlight:', miss)

vde = ns['load_voice'](V + 'de_DE-thorsten-high.onnx'); ves = ns['load_voice'](V + 'es_ES-davefx-medium.onnx')
buf = bytearray()
def clean_es(g):
    g = g.split(';')[0]
    g = re.sub(r'\([^)]*\)', '', g).strip(' ,')
    return g
for i, w in enumerate(site['words']):
    de = w['w'].replace('der/die ', 'der ')
    a = {}
    for kind, voice, text in (('d', vde, de), ('e', ves, clean_es(w['g']))):
        pcm = ns['trim_norm'](ns['synth'](voice, text + '.'))
        mp3 = ns['to_mp3'](pcm)
        a[kind] = [10, len(buf), len(mp3), round(len(pcm) / 22050 * 1000)]
        buf.extend(mp3)
    w['a'] = a
    if i % 200 == 0: print(i, flush=True)
open(os.path.join(OUT, 'audio', 'pack-10.mp3'), 'wb').write(buf)
site['v'] = 'rc1.1'
json.dump(site, open(os.path.join(OUT, 'data', 'words.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('pack-10 bytes', len(buf))
