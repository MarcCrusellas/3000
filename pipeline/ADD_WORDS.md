# Adding words (1001 to 3000)

How the data and audio for words 1 to 1000 were built, and what to change to add more.
**Words 1001 to 2000 were added on 2026-11-21 with `scripts/extend/`**: see "How 1001 to 2000 were added" at the end.
That is the way to do 2001 to 3000 as well; the sections before it describe the original 1000-word build.

**Be warned:** these scripts were written for a one-off 1000-word build. Several steps were run by hand,
and `1000` is hard-coded in a few places. Read the "Before you run" list first.

## Inputs (not in git, download them)

| file | from | goes in |
|---|---|---|
| `deu_sentences_detailed.tsv.bz2`, `spa_sentences.tsv.bz2`, `deu-spa_links.tsv.bz2` (plus `eng_*` and `deu-eng_links`) | https://downloads.tatoeba.org/exports/ | `<tatoeba_dir>/` |
| `sentences_with_audio.csv` (inside `sentences_with_audio.tar.bz2`) | same | `<tatoeba_dir>/` |
| `nouns.csv` | https://github.com/gambolputty/german-nouns | anywhere |
| German entries of the English Wiktionary (JSONL) | https://kaikki.org/dictionary/German/ | piped through `wikt_filter.py` |

Python packages: `spacy` + `de_core_news_md`, `wordfreq`, `simplemma`, `numpy`, `lameenc`, `edge-tts`. Also `ffmpeg` on the PATH.
`pipeline/build/parsed.pkl` is a 14 MB cache that `build_data.py` writes the first time. It is not in git.

## Before you run (changes still to make)

0. **Pack numbers clash.** Sentence audio goes in `pack-30 + (rank-1)//100`, so words 1001 to 1100 would land in
   `pack-40`, which already holds the single-word audio. `pack_v2.py` now stops with an error if that would happen.
   Pick one fix before running:
   - move word audio to its own range, for example `pack-90 + (rank-1)//1000` in `edge_words.py` (it rewrites every
     word's `a.d` / `a.e`, so the 1000 existing words move too), or
   - skip 40 in `pack_v2.py` (`p = 30 + (r-1)//100; p += p >= 40`).
1. **Hard-coded 1000.** `build_data.py` (`lim = max(r, 1000)`), `finalize.py` (`> 1000`) and `lexicon_step1.py`
   (extras are "outside the 1000 list") all treat 1000 as the end of the list. Change them to the new size.
2. **New sentence rules** (agreed on 2026-11-19). `build_data.py` currently allows up to 2 words later than the
   list limit. For 1001 to 3000, use:
   - at most 2 words you haven't reached yet per sentence, sentence at most ~12 words;
   - prefer unknown words that come soon (within about the next 500 ranks), so hearing them early pays off;
   - every word keeps **at least one** sentence where it is the only unknown word. Review tests use that one;
   - drop rude or odd subtitle words from the list (for example rank 1003 is "Arsch").
   Coverage check done on 2026-11-19: 1,947 of the 2,000 words have at least 3 Tatoeba sentences with Spanish;
   1,392 have 3 where every other word is already known.
3. **`words.json` is built from scratch, not appended.** The first `words.json` came from `render.py pack` (the old
   Piper step) reading `final.json`. Either rebuild everything for 3000 words, keeping the same keys (`W:der`, `N:Zeit`...)
   so saved progress still matches, or write a small merge step that appends words 1001+ to the current file.
   Keys must not change: progress is stored by key.
4. **Manual steps.** Spanish meanings (`glosses_es.tsv`, `extra_glosses*.tsv`) and the sentences for words with too few
   Tatoeba ones (`supplement.json`) were written for the project, not by a script. Plan for that: 2000 glosses to write and check.

## Order (as used for 1 to 1000)

Paths: `B=pipeline/build`, `T=<tatoeba_dir>`, `N=<nouns.csv>`, `SITE=site` (holds `data/` and `audio/`).

1. Word list and sentences
   ```
   python3 -I build_data.py $T $N $B 3000            # ranks.json, words_raw.json, parsed.pkl
   # manual: glosses_es.tsv (meaning per word), supplement.json (extra sentences where Tatoeba has too few)
   python3 -I finalize.py $B                          # final.json
   ```
2. Lexicon (token maps, forms, cases)
   ```
   python3 -I lexicon_step1.py $B $SITE               # lex1.json
   curl -s <kaikki German JSONL> | python3 -I wikt_filter.py want.json wikt.jsonl
   # manual: extra_glosses.tsv (meanings for non-list words that appear in sentences)
   python3 -I lexicon_step2.py $B wikt.jsonl $N $SITE  # merges into SITE/data/words.json
   python3 -I make_forms.py wikt.jsonl $N $SITE        # SITE/data/forms.json
   ```
3. Two more sentences per word (5 in total)
   ```
   python3 -I add_sents.py $T $B $SITE/data/words.json $B/add_sents.json
   # manual: extra_glosses2.tsv
   python3 -I merge_sents.py $B $N $SITE/data/words.json $B/render_new.json
   ```
4. Native recordings (licensed only: CC BY / CC BY-NC)
   ```
   python3 -I make_audio_plan.py queue $SITE/data/words.json $T/sentences_with_audio.csv native_q.json
   python3 -I fetch_native.py native_q.json <native_dir>        # ~12 s per file, 8 at a time
   python3 -I make_audio_plan.py plan $SITE/data/words.json $T/sentences_with_audio.csv <native_dir> $B/native_plan.json
   ```
5. Sentence audio (Microsoft voices for sentences without a native recording)
   ```
   python3 edge_render.py $B/native_plan.json $SITE/data/words.json <native_dir> <clips_dir>
   python3 pack_v2.py $B/native_plan.json <clips_dir> $SITE          # after fixing step 0
   ```
6. Word audio
   ```
   python3 edge_words.py $SITE <word_cache_dir>
   ```
   Behind a proxy that inspects TLS, set `EDGE_TTS_CA=/path/to/ca-bundle.crt` for steps 5 and 6.

Voices: German sentences alternate Seraphina and Florian (Multilingual) by sentence id; sentences of 3 words or fewer use
Katja and Conrad; slow version at rate -30%; Spanish Elvira and Álvaro; native recordings slowed with ffmpeg atempo 0.8.

## Expected size

About 105 MB of audio now for 1000 words, about 300 MB for 3000. The app only downloads the packs it needs.
Rendering 2000 words is a few hours, mostly audio.

## After

- Run `tests/e2e.py` and try the app with the new data (Palabras, a listening loop, a Repasar session).
- Check a sample of the new glosses and sentences by ear.
- Deploy: commit `site/data/` and the new `site/audio/` packs.

## How 1001 to 2000 were added (2026-11-21)

`scripts/extend/` appends to the live `words.json` instead of rebuilding it, so keys, ranks, sentence ids and the
old audio packs stay exactly as they were. Inputs as above (Tatoeba exports, `nouns.csv`, the kaikki German JSONL).

```
G=/tmp/g3   # scratch: tatoeba/, parsed.pkl, clips, caches
python3 -I extend/parse.py $T $G/parsed.pkl                         # every deu sentence with Spanish, 3-18 words (~2 min)
python3 -I extend/sharp_s.py $G/parsed.pkl build 2100 $G/sharp.json  # ß words ranks.json lost (see below)
python3 -I extend/pick_words.py build $G/parsed.pkl $N site/data/words.json 1000 $G/newwords.json $G/sharp.json
# manual: build/glosses_es_2.tsv  (key, meaning, optional w=<display> pl=<plural or ->)
python3 -I extend/select_sents.py $T $G/parsed.pkl build site/data/words.json $G/newwords.json $G/sel.json
# manual, repeat until select_sents prints "keys to gloss 0" and every word has its supplements:
#   build/extra_glosses_2.tsv  meanings for words outside the list that the sentences use
#   build/supplement_2.tsv     own sentences (key, de, es) for words Tatoeba has too few for
python3 -I extend/merge.py build $G/parsed.pkl $N $G/wikt.jsonl $G/newwords.json $G/sel.json site $G/render.json
# audio: queue/plan for the render list only (see make_audio_plan.py), fetch_native.py, then
EDGE_TTS_CA=... python3 edge_render.py $G/plan.json $G/render_words.json $G/native $G/clips
python3 -I extend/pack_ext.py $G/plan.json $G/render.json $G/clips site
EDGE_TTS_CA=... python3 extend/words_ext.py site $G/wcache
```

What changed on the way:
- **ß words were missing.** wordfreq folds ß into ss, so `build_data.py` never matched Straße, Spaß, außerdem, Fuß...
  against Tatoeba, and they are not in `ranks.json` (13 of them should have been in the first 1000). `sharp_s.py`
  recomputes their scores; they now sit at the start of 1001+ and in frequency order after that.
- **Dropped from the list** (`extend/remap.py`): lemmatizer leftovers (geh, sag, Gute, könnsten...), which `REMAP`
  folds into the real word, and rude subtitle words (Arsch, ficken, Scheiße).
- **Names allowed**: sentences may contain common Tatoeba names and places (Tom, Maria, Boston...), which are not
  counted as unknown words. Other proper nouns still rule a sentence out.
- **Sentence rules** as agreed: see the docstring of `select_sents.py`. 926 of the 1000 new words have a sentence
  where they are the only new word. Words with fewer than 2 short sentences or 3 in all got sentences written for the project.
- **Longer sentences** (11-18 words, native recordings first) were added to every word that Tatoeba has them for,
  up to 2 per word, after the short ones. They carry `L: 1`; the app keeps them out of most review tests.
- **Packs**: new words' sentences in `pack-41..50`, new sentences of words 1-1000 in `pack-71..80`,
  single-word audio of 1001+ in `pack-61`. `pack-30..40` are untouched.

For 2001 to 3000: the same commands with the next 1000. Their sentence packs continue at 51..60, which are free;
single-word audio goes to pack-62 (`words_ext.py site <cache> 2001`).
