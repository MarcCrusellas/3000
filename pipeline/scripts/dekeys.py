import re
FUNC = {'DET', 'PRON', 'ADP', 'PART', 'CCONJ', 'SCONJ'}

def cls_of(pos):
    if pos == 'NOUN': return 'N'
    if pos in ('VERB', 'AUX'): return 'V'
    if pos in ('ADJ', 'ADV'): return 'A'
    if pos in FUNC: return 'F'
    if pos == 'NUM': return 'NUM'
    if pos == 'INTJ': return 'I'
    if pos == 'PROPN': return 'P'
    return 'X'


LEMMA_FIX = {'mussen': 'müssen', 'muss': 'müssen', 'mussn': 'müssen', 'musst': 'müssen', 'müsst': 'müssen',
             'hab': 'haben', 'habn': 'haben', 'hast': 'haben', 'habt': 'haben', 'heisst': 'heißen', 'heißt': 'heißen',
             'lässt': 'lassen', 'lass': 'lassen', 'kannst': 'können', 'bist': 'sein', 'wirst': 'werden',
             'willst': 'wollen', 'wussen': 'wissen', 'weißt': 'wissen', 'eur': 'euer', 'aller': 'alle', 'all': 'alle',
             'vieler': 'viel', 'kannstn': 'können', 'viele': 'viel', 'einiger': 'einige', 'meister': 'meist', 'meisten': 'meist'}
NOUN_FIX = {'Danke': 'W:danke', 'Hab': 'W:haben', 'Halt': 'W:halt', 'Erster': 'W:erster',
            'Bisschen': 'W:bisschen', 'Schau': 'W:schauen', 'Deutsche': 'N:Deutsch'}
DROP = {'W:berliner'}

def key_of(tok):
    text, pos, lemma, _ = tok
    if pos == 'SVP':
        return None
    c = cls_of(pos)
    if c == 'N':
        lemma = lemma[:1].upper() + lemma[1:]
        return NOUN_FIX.get(lemma, 'N:' + lemma)
    if c in ('P', 'X'):
        return c + ':' + lemma
    lemma = LEMMA_FIX.get(lemma.lower(), lemma.lower())
    if lemma == 'sein' and c == 'F':
        return 'S:sein'
    return 'W:' + lemma

