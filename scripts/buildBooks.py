# "Kitaptan çalış" için kitap PDF'lerini sayfa görüntülerine çevirir ve her sayfanın ikiye bölünebileceği yeri bulur.
# Girdi: kaynaklar/*.pdf (telifli, git'e girmez). Çıktı YALNIZCA yerelde: local-data/kitaplar/<kitap>/
#   p001.webp …       sayfa görüntüleri
#   kitap.json        başlık, sayfa sayısı, her sayfanın bölme noktası (yoksa tam sayfa), üniteler, sayfa metni (arama için)
#
# Kullanım: python scripts/buildBooks.py [kitap-id …]
import json
import os
import re
import sys

import pymupdf
from PIL import Image

OUT = 'local-data/kitaplar'
WIDTH = 1300  # görüntü genişliği (px); telefonda yarım sayfa için yeterince net

BOOKS = [
    {
        'id': 'essential-grammar-in-use',
        'title': 'Essential Grammar in Use (Murphy, 4. baskı)',
        'short': 'Essential Grammar in Use',
        'level': 'A1–A2 · Temel',
        'pdf': 'kaynaklar/Essential Grammar in Use.pdf',
        'firstUnitPage': 11,
        'units': 115,
        # Metin katmanı gürültülü; düzen kesin olarak ünite başına 2 sayfa
        'fixedStride': True,
        'tocPages': range(3, 10),
    },
    {
        'id': 'english-grammar-in-use',
        'title': 'English Grammar in Use (Murphy, 5. baskı)',
        'short': 'English Grammar in Use',
        'level': 'B1–B2 · Orta',
        'pdf': 'kaynaklar/English Grammar in USE 5th Edition R.Murphy @ENGLISH_RGN.pdf',
        'firstUnitPage': 14,
        'units': 145,
        'tocPages': range(3, 12),
    },
]


def find_split(img):
    """Sayfanın ortasına yakın (yüksekliğin %30–70'i) boş yatay şerit; yoksa None (tam sayfa: tablo, resim vb.).
    Sayfa boyunca hep dolu olan sütunlar (kenardaki renkli bölüm şeridi gibi) hesaba katılmaz."""
    g = img.convert('L').resize((img.width // 2, img.height // 2))
    w, h = g.size
    px = g.load()
    xs = list(range(int(w * 0.03), int(w * 0.97), 2))
    # Hep dolu sütunlar: satırların %60'ından fazlasında koyu
    rows = range(0, h, 4)
    keep = [x for x in xs if sum(1 for y in rows if px[x, y] < 200) < len(rows) * 0.6]
    blank = []
    for y in range(h):
        dark = 0
        for x in keep:
            if px[x, y] < 200:
                dark += 1
                if dark > 2:
                    break
        blank.append(dark <= 2)
    lo, hi = int(h * 0.30), int(h * 0.70)
    runs = []
    y = lo
    while y < hi:
        if blank[y]:
            s = y
            while y < h and blank[y]:
                y += 1
            runs.append((s, y - s))
        y += 1
    min_gap = max(5, int(h * 0.008))
    runs = [r for r in runs if r[1] >= min_gap]
    if not runs:
        return None
    s, run = min(runs, key=lambda r: abs((r[0] + r[1] / 2) / h - 0.5))
    return round((s + run / 2) / h, 4)


def unit_pages(texts, first, count):
    """Her ünitenin ilk sayfası: sırayla, metninde 'Unit N' geçen ilk sayfa (yoksa önceki + 2)."""
    out = []
    p = first
    for u in range(1, count + 1):
        found = None
        for k in range(p, min(p + 8, len(texts) + 1)):
            # '➜ Unit 137' / '→ Unit 5' gibi göndermeler sayılmaz
            t = re.sub(r'[➜→]\s*Units?\s*[\d, –-]+', ' ', texts[k - 1])
            if re.search(r'Unit\s*' + str(u) + r'(?!\d)', t) or re.search(r'(?:^|\s)' + str(u) + r'\s', t[:12]):
                found = k
                break
        p = found or p
        out.append(p)
        p += 2
    return out


def toc(doc, pages):
    """İçindekiler: '65 a/an ...' satırlarından ünite adları."""
    names = {}
    for i in pages:
        if i - 1 >= len(doc):
            break
        for line in doc[i - 1].get_text().split('\n'):
            m = re.match(r'^\s*(\d{1,3})\s+(.{2,80}?)\s*$', line)
            if m:
                n = int(m.group(1))
                if n not in names and not re.match(r'^[\d\s.,–-]+$', m.group(2)):
                    names[n] = m.group(2)
    return names


def build(book):
    out = os.path.join(OUT, book['id'])
    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(book['pdf'])
    names = toc(doc, book['tocPages'])
    pages = []
    for i, page in enumerate(doc):
        n = i + 1
        zoom = WIDTH / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        img.save(os.path.join(out, f'p{n:03d}.webp'), 'WEBP', quality=72, method=4)
        text = re.sub(r'\s+', ' ', page.get_text()).strip()
        pages.append({'n': n, 'w': pix.width, 'h': pix.height, 'split': find_split(img), 'text': text[:4000]})
        if n % 50 == 0:
            print(f"  {book['id']}: {n}/{len(doc)}")
    units = []
    starts = (
        [book['firstUnitPage'] + 2 * i for i in range(book['units'])]
        if book.get('fixedStride')
        else unit_pages([p['text'] for p in pages], book['firstUnitPage'], book['units'])
    )
    for u in range(1, book['units'] + 1):
        p = starts[u - 1]
        units.append({'no': u, 'title': names.get(u, f'Unit {u}'), 'page': p})
        pages[p - 1]['unit'] = u
        pages[p]['unit'] = u
    meta = {k: book[k] for k in ('id', 'title', 'short', 'level')}
    meta.update({'pageCount': len(pages), 'firstUnitPage': book['firstUnitPage'], 'units': units, 'pages': pages})
    with open(os.path.join(out, 'kitap.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False)
    full = sum(1 for p in pages if p['split'] is None)
    print(f"{book['id']}: {len(pages)} sayfa, {len(pages) - full} bölündü, {full} tam sayfa; {len(names)} ünite adı bulundu")


if __name__ == '__main__':
    want = set(sys.argv[1:])
    for b in BOOKS:
        if not want or b['id'] in want:
            build(b)
