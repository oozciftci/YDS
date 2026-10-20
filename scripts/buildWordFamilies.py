# Kelime aileleri: scripts/data/word_families/*.txt → public/data/word_families.json
# Her satır bir aile: "kelime|tür|Türkçe; kelime|tür|Türkçe; …" (tür: n, v, adj, adv, prep, conj; "n/v" gibi birleşik olabilir).
# Özgün derleme (türev + anlam bilgisi); telifli içerik değildir, yayına girebilir.
#
# Kullanım: python scripts/buildWordFamilies.py
import glob
import json
import os
import re

SRC = 'scripts/data/word_families'
OUT = 'public/data/word_families.json'
POS = {'n', 'v', 'adj', 'adv', 'prep', 'conj'}


def main():
    families, problems = [], []
    for f in sorted(glob.glob(os.path.join(SRC, '*.txt'))):
        for i, line in enumerate(open(f, encoding='utf-8'), 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            fam = []
            for part in line.split(';'):
                bits = [b.strip() for b in part.split('|')]
                if len(bits) != 3 or not bits[0]:
                    # "a; b" gibi anlam içi noktalı virgül: önceki anlamın devamı
                    if fam and len(bits) == 1 and bits[0]:
                        fam[-1][2] += '; ' + bits[0]
                        continue
                    problems.append(f'{os.path.basename(f)}:{i}: {part!r}')
                    continue
                w, p, tr = bits
                if not all(x in POS for x in p.split('/')):
                    problems.append(f'{os.path.basename(f)}:{i}: tür {p!r}')
                fam.append([w, p, tr])
            if len(fam) >= 1:
                families.append(fam)
    # Aynı kelime birden çok ailede: en büyük aile kazanır (istemci tarafı dizin için bilgi)
    seen = {}
    for idx, fam in enumerate(families):
        for w, _, _ in fam:
            k = w.lower()
            if k in seen and len(families[seen[k]]) >= len(fam):
                continue
            seen[k] = idx
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'families': families}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(families)} aile, {sum(len(f) for f in families)} kelime biçimi, {len(seen)} benzersiz kelime; {os.path.getsize(OUT) // 1024} KB')
    if problems:
        print(f'{len(problems)} sorunlu parça:')
        print('\n'.join(problems[:40]))


main()
