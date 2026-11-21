"""Download Tatoeba native recordings in priority order (Round 1 first). Usage: python3 -I fetch_native.py <queue.json> <native_dir>"""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
q = json.load(open(sys.argv[1])); out = sys.argv[2]
def fetch(item):
    rnd, sid, aid = item
    p = os.path.join(out, f'{aid}.mp3')
    if os.path.exists(p):
        return True
    for attempt in range(3):
        try:
            req = urllib.request.Request(f'https://tatoeba.org/en/audio/download/{aid}', headers={'User-Agent': 'personal-study-build/1.0'})
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read()
            open(p + '.tmp', 'wb').write(b); os.replace(p + '.tmp', p)
            return True
        except Exception as e:
            time.sleep(3)
    return False
t0 = time.time()
with ThreadPoolExecutor(8) as ex:
    for i, ok in enumerate(ex.map(fetch, q)):
        if i % 50 == 0:
            print(i, f'{time.time()-t0:.0f}s', flush=True)
print('DONE', flush=True)
