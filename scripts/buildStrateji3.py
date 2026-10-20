# MODADİL "YDS Sınav Stratejileri 3" (taranmış soru kitabı) → görüntü tabanlı online test.
# Kitabın metni çıkarılmaz; her sorunun sayfadaki kutusu (Windows OCR ile bulunan soru numaralarından) ve
# kitabın sonundaki cevap anahtarı (local-data/yds/_eksik/strateji3_anahtar.txt, görüntüden okunarak) birleştirilir.
#
# Çıktı YALNIZCA yerelde (telifli): local-data/kitaplar/modadil-sinav-stratejileri-3/
#   p001.webp …     sayfa görüntüleri ("Kitaptan çalış"ta da okunur)
#   kitap.json      okuyucu için (üniteler = testler)
#   testler.json    testler: konu, sayfalar, her soru için sayfa + kutu + doğru cevap
#   ocr/pNNN.json   OCR önbelleği (yeniden çalıştırınca tekrar OCR yapılmaz)
#
# Kullanım: python scripts/buildStrateji3.py [--no-images]
import json
import os
import re
import subprocess
import sys
import tempfile

import pymupdf
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from buildBooks import find_split  # noqa: E402

PDF = 'kaynaklar/Modadil sınav stratejileri 3.pdf'
OUT = 'local-data/kitaplar/modadil-sinav-stratejileri-3'
KEY = 'local-data/yds/_eksik/strateji3_anahtar.txt'
WIDTH = 1300
OCR_WIDTH = 1800

# Konu → (uygulamadaki soru tipi, ilk testin sayfası, sayfa/test). İçindekiler (s. 7–9) ile aynı.
SECTIONS = [
    ('Tenses', 'grammar', 13, 2),
    ('Modals', 'grammar', 33, 2),
    ('Passive Voice', 'grammar', 53, 2),
    ('Gerunds & Infinitives', 'grammar', 73, 2),
    ('Adjectives & Adverbs', 'grammar', 93, 2),
    ('Adjective Clauses', 'grammar', 113, 2),
    ('Noun Clauses', 'grammar', 133, 2),
    ('If Clauses', 'grammar', 153, 2),
    ('Adverb Clauses', 'grammar', 173, 2),
    ('Quantifiers', 'grammar', 203, 2),
    ('Cloze Tests', 'cloze', 225, 2),
    ('Cümle Tamamlama', 'completion', 245, 2),
    ('İngilizce-Türkçe Çeviri', 'translation', 265, 2),
    ('Türkçe-İngilizce Çeviri', 'translation', 285, 2),
    ('Okuma Parçaları', 'reading', 305, 5),
    ('Diyalog', 'dialogue', 345, 2),
    ('Yakın Anlam', 'paraphrase', 365, 2),
    ('Paragraf Tamamlama', 'paragraph', 385, 2),
    ('Anlam Bütünlüğünü Bozan Cümle', 'irrelevant', 405, 2),
]
# Paragrafa bağlı sorular: kartta "sayfanın tamamı" öne çıkar
PASSAGE_TYPES = {'cloze', 'reading'}


def slug(s):
    tr = str.maketrans('çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU')
    return re.sub(r'[^a-z0-9]+', '-', s.translate(tr).lower()).strip('-')


def read_key():
    key = {}
    for line in open(KEY, encoding='utf-8'):
        if line.startswith('#') or ': ' not in line:
            continue
        k, v = line.strip().split(': ')
        sec, n = k.split(' / Test-')
        key[(sec, int(n))] = v
    return key


def ocr_page(doc, p):
    cache = os.path.join(OUT, 'ocr', f'p{p:03d}.json')
    if os.path.exists(cache):
        return json.load(open(cache, encoding='utf-8'))
    pg = doc[p - 1]
    z = OCR_WIDTH / pg.rect.width
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        png = f.name
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(z, z))
    pix.save(png)
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/winOcr.ps1', png],
                       capture_output=True, text=True, encoding='utf-8')
    os.unlink(png)
    data = json.loads(r.stdout.lstrip('﻿') or '{"lines": []}')
    data['w'], data['h'] = pix.width, pix.height
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    json.dump(data, open(cache, 'w', encoding='utf-8'))
    return data


def numbers_on(data, page):
    """Satır başındaki 'N.' biçimli soru numaraları: (no, sütun, y-oranı)."""
    w, h = data['w'], data['h']
    out = []
    for line in data['lines']:
        if not line['words']:
            continue
        t = line['words'][0]
        m = re.match(r'^(\d{1,2})[.,]$', t['t'])
        if not m:
            continue
        x = t['x'] / w
        # Tek sayfada numaralar ~%3–5 ve ~%47–49'da; çift sayfada kenar şeridi solda, ~%10–12 ve ~%54–57
        off = 0 if page % 2 else 0.07
        if 0.01 + off <= x <= 0.08 + off:
            col = 0
        elif 0.44 + off <= x <= 0.52 + off:
            col = 1
        else:
            continue  # metin içindeki bir sayı
        out.append((int(m.group(1)), col, t['y'] / h))
    return out


COL_TOP = 0.1  # sütunun ilk sorusu en geç buradan başlar (başlık/yönerge kutusunun altı)


def infer_missing(found, count, tpages):
    """OCR'ın okuyamadığı numaraları komşularından tahmin eder (yerinde günceller).
    - n-1 ve n+1 aynı sayfa/sütundaysa: aralarının ortası
    - yalnız n+1 biliniyorsa ve n-1 o sütunda değilse: sütunun başı (n, n+1'in üstündeki ilk soru)
    - n-1 biliniyor, n+1 yok ya da başka sütundaysa: n-1'in altında, sütundaki ortalama soru aralığı kadar"""
    for _ in range(3):  # ardışık eksikler için birkaç tur
        for n in range(1, count + 1):
            if n in found:
                continue
            prev, nxt = found.get(n - 1), found.get(n + 1)
            if prev and nxt and prev[:2] == nxt[:2]:
                found[n] = (prev[0], prev[1], (prev[2] + nxt[2]) / 2)
            elif nxt and not (prev and prev[:2] == nxt[:2]) and nxt[2] > COL_TOP + 0.08:
                found[n] = (nxt[0], nxt[1], COL_TOP)
            elif prev and not (nxt and nxt[:2] == prev[:2]):
                same = sorted(f[2] for f in found.values() if f[:2] == prev[:2])
                gaps = [b - a for a, b in zip(same, same[1:])]
                gap = sum(gaps) / len(gaps) if gaps else 0.2
                if prev[2] + gap < 0.93:
                    found[n] = (prev[0], prev[1], prev[2] + gap)


def build(images=True):
    os.makedirs(OUT, exist_ok=True)
    doc = pymupdf.open(PDF)
    key = read_key()

    # 1) Sayfa görüntüleri + okuyucu için kitap.json
    pages = []
    for i, page in enumerate(doc):
        n = i + 1
        file = os.path.join(OUT, f'p{n:03d}.webp')
        if images or not os.path.exists(file):
            zoom = WIDTH / page.rect.width
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            img.save(file, 'WEBP', quality=72, method=4)
        else:
            img = Image.open(file)
        pages.append({'n': n, 'w': img.width, 'h': img.height, 'split': find_split(img)})
        if n % 50 == 0:
            print(f'  görüntü {n}/{len(doc)}')

    # 2) Testler ve soru kutuları
    tests, units, report = [], [], []
    for sec, typ, first, per in SECTIONS:
        k = 1
        while (sec, k) in key:
            answers = key[(sec, k)]
            tpages = list(range(first + (k - 1) * per, first + k * per))
            found = {}
            for p in tpages:
                for no, col, y in numbers_on(ocr_page(doc, p), p):
                    if 1 <= no <= len(answers) and no not in found:
                        found[no] = (p, col, y)
            infer_missing(found, len(answers), tpages)
            qs = []
            for no in range(1, len(answers) + 1):
                if no not in found:
                    qs.append({'n': no, 'page': None, 'box': None, 'answer': answers[no - 1]})
                    continue
                p, col, y = found[no]
                # Bitiş: aynı sayfa ve sütundaki bir sonraki numara; yoksa sütunun altı
                nxt = [f[2] for f in found.values() if f[0] == p and f[1] == col and f[2] > y]
                y1 = min(nxt) - 0.008 if nxt else 0.955
                off = 0 if p % 2 else 0.07
                x0, x1 = (0.015 + off, 0.465 + off) if col == 0 else (0.445 + off, min(0.995, 0.93 + off))
                qs.append({'n': no, 'page': p, 'box': [x0, round(max(0, y - 0.012), 4), x1, round(y1, 4)], 'answer': answers[no - 1]})
            missing = [q['n'] for q in qs if q['page'] is None]
            if missing:
                report.append(f'{sec} / Test-{k}: bulunamayan soru {missing}')
            tid = f'{slug(sec)}-{k}'
            tests.append({'id': tid, 'section': sec, 'type': typ, 'no': k, 'pages': tpages,
                          'passage': typ in PASSAGE_TYPES, 'questions': qs})
            units.append({'no': len(units) + 1, 'title': f'{sec} · Test {k}', 'page': tpages[0]})
            k += 1
        print(f'{sec}: {k - 1} test')

    meta = {'id': os.path.basename(OUT), 'title': 'MODADİL YDS Sınav Stratejileri 3', 'short': 'Sınav Stratejileri 3',
            'level': 'YDS · Soru bankası', 'pageCount': len(pages), 'firstUnitPage': 13, 'units': units, 'pages': pages}
    json.dump(meta, open(os.path.join(OUT, 'kitap.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump({'title': meta['title'], 'tests': tests}, open(os.path.join(OUT, 'testler.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    total = sum(len(t['questions']) for t in tests)
    miss = sum(1 for t in tests for q in t['questions'] if q['page'] is None)
    print(f'{len(tests)} test, {total} soru; kutusu bulunamayan {miss}')
    print('\n'.join(report) or 'Eksik yok')


if __name__ == '__main__':
    build(images='--no-images' not in sys.argv)
