"""Shared fixes for the extension scripts: surface keys folded into a list word, and keys never used as list words."""
REMAP = {'N:Kannst': 'W:können', 'W:geh': 'W:gehen', 'W:komm': 'W:kommen', 'W:nimm': 'W:nehmen', 'W:lasst': 'W:lassen',
         'N:Gute': 'W:gut', 'N:Neue': 'W:neu', 'N:Lesen': 'W:lesen', 'W:welchenr': 'W:welcher', 'W:voller': 'W:voll',
         'W:öfter': 'W:oft', 'N:Vorsitzend': 'N:Vorsitzende', 'W:brauchsen': 'W:brauchen', 'W:könnsten': 'W:können',
         'W:sprich': 'W:sprechen', 'W:sag': 'W:sagen', 'W:solltest': 'W:sollen', 'W:könntest': 'W:können',
         'N:Tausend': 'W:tausend', 'W:schick': 'W:schicken',
         # added for 1001-2000
         'W:müssten': 'W:müssen', 'W:würdest': 'W:werden', 'W:findest': 'W:finden', 'W:meinst': 'W:meinen',
         'W:könnte': 'W:können', 'W:könnt': 'W:können', 'W:dürfte': 'W:dürfen', 'W:möchtest': 'W:mögen', 'W:wär': 'W:sein',
         'W:deine': 'W:dein', 'N:Glaub': 'W:glauben', 'W:tut': 'W:tun', 'W:gegessen': 'W:essen', 'W:jemander': 'W:jemand',
         'N:Jemand': 'W:jemand', 'W:gefällen': 'W:gefallen', 'W:letzten': 'W:letzter', 'N:Welcher': 'W:welcher',
         'N:Mannschafte': 'N:Mannschaft', 'N:Ja': 'W:ja', 'W:gewiß': 'W:gewiss', 'N:Können': 'W:können',
         'W:gib': 'W:geben', 'W:kennst': 'W:kennen', 'W:stell': 'W:stellen', 'W:hättest': 'W:haben', 'W:wüssen': 'W:wissen',
         'W:bin': 'W:sein', 'W:darfstn': 'W:dürfen', 'N:Witze': 'N:Witz', 'N:Kuche': 'N:Kuchen', 'W:jede': 'W:jeder',
         'W:issen': 'W:essen', 'N:Englische': 'W:englisch', 'N:Allgemein': 'W:allgemein', 'N:Alte': 'W:alt', 'N:Böse': 'W:böse',
         'N:Arme': 'W:arm', 'N:Jung': 'W:jung', 'N:Richtige': 'W:richtig', 'N:Bestes': 'W:gut', 'N:Einzige': 'W:einzig',
         'W:irgend': 'W:irgendein', 'W:irgendwelch': 'W:irgendwelcher', 'W:daß': 'W:dass', 'W:sollten': 'W:sollen', 'N:Besseres': 'W:gut', 'W:mach': 'W:machen'}
# lemmatizer leftovers (nominalised adjectives, odd forms), rude words, ambiguous proper-noun-like keys
DROP = set('''N:Arsch W:ficken N:Au N:Jung N:Allgemein N:Freie N:Voraus N:Gleiche N:Einzige N:Böse N:Alte N:Arme
N:Dritter N:Hamburger N:Twitter N:Willkommen W:fällen W:willen N:Mädel N:Gut W:geraten
N:Scheiße N:Scheiß W:scheiße W:weißen'''.split())
