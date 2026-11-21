"""Decide, per sentence, whether it uses a native Tatoeba recording or a Microsoft voice.

Only recordings with a licence (CC BY or CC BY-NC) are used; recordings with no licence are skipped.

Usage:
  python3 -I make_audio_plan.py queue <words.json> <sentences_with_audio.csv> <queue_out.json>
      Licensed recordings to download, as [round, sid, audio_id]. Feed it to fetch_native.py.
  python3 -I make_audio_plan.py plan  <words.json> <sentences_with_audio.csv> <native_dir> <plan_out.json>
      {sid: {"native": [audio_id, user, licence]}} when the recording was downloaded, {} otherwise (Microsoft voice).
      Feed it to edge_render.py and pack_v2.py.

sentences_with_audio.csv comes from https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2
(tab-separated: sentence_id, audio_id, username, licence, attribution_url).
"""
import csv, json, os, sys

role = sys.argv[1]
words = json.load(open(sys.argv[2]))
allsids = [sid for w in words['words'] for sid in w['s']]  # 't<id>' = Tatoeba, others are our own sentences
sids = [s for s in allsids if s.startswith('t')]
want = {int(s[1:]) for s in sids}

rec = {}
with open(sys.argv[3], encoding='utf-8', newline='') as f:
    for row in csv.reader(f, delimiter='\t'):
        if len(row) < 4 or not row[0].isdigit():
            continue
        sid, aid, user, lic = int(row[0]), row[1], row[2], row[3].strip()
        if sid in want and lic.startswith('CC BY') and sid not in rec:
            rec[sid] = [aid, user, lic]

if role == 'queue':
    q, seen = [], set()
    for s in sids:
        r = rec.get(int(s[1:]))
        if r and s not in seen:
            seen.add(s); q.append([1, s, r[0]])
    json.dump(q, open(sys.argv[4], 'w'))
    print('queue', len(q), 'of', len(set(sids)), 'sentences')
elif role == 'plan':
    nat, out = sys.argv[4], sys.argv[5]
    plan = {}
    for s in dict.fromkeys(allsids):
        r = rec.get(int(s[1:])) if s.startswith('t') else None
        plan[s] = {'native': r} if r and os.path.exists(os.path.join(nat, r[0] + '.mp3')) else {}
    json.dump(plan, open(out, 'w'))
    print('plan', len(plan), 'native', sum(1 for v in plan.values() if v))
else:
    sys.exit(__doc__)
