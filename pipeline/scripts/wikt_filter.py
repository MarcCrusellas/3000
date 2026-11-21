"""Filter the English-Wiktionary German JSONL (stdin) to entries whose word is in want.json. Usage: curl ... | python3 -I wikt_filter.py want.json out.jsonl"""
import json, re, sys
RX = re.compile(r'"word": "([^"]*)"')
want = set(json.load(open(sys.argv[1])))
out = open(sys.argv[2], 'w'); n = k = 0
for line in sys.stdin:
    n += 1
    if not any(m in want for m in RX.findall(line)): continue
    d = json.loads(line)
    if d.get('word') not in want: continue
    if d.get('pos') not in ('verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'article', 'particle', 'num', 'intj'): continue
    keep = {x: d.get(x) for x in ('word', 'pos', 'forms', 'senses', 'head_templates')}
    keep['senses'] = [{'glosses': s.get('glosses'), 'tags': s.get('tags')} for s in (d.get('senses') or [])][:6]
    out.write(json.dumps(keep, ensure_ascii=False) + '\n'); k += 1
print('lines', n, 'kept', k)
