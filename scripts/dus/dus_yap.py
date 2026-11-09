# DUS çıkmış soru kitapçıklarından (local-data/dus/pdf/*.pdf, ÖSYM) uygulamanın görüntü tabanlı soru verisini üretir.
# Yalnızca yerel; çıktı local-data/dus/sinavlar/<sınav>/ (sinav.json + pNNN.webp) — yayına girmez.
#   sinav.json: { id, title, year, pages: [{w, h}], tests: [{ key: 'tbt'|'kbt', title, questions: [{ n, page, box, answer, text }] }] }
#   box: sayfadaki kutu (oran) x0, y0, x1, y1; answer: 'A'..'E' ya da 'X' (iptal)
# Kullanım: python -I scripts/dus/dus_yap.py [--kontrol]   (--kontrol: yalnızca sayıları yazar, dosya üretmez)
import json
import os
import re
import sys

import pymupdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'local-data', 'dus', 'pdf')
OUT = os.path.join(ROOT, 'local-data', 'dus', 'sinavlar')
SCALE = 2.0  # 595 pt → ~1190 px genişlik
TESTS = [('tbt', 'Temel Bilimler Testi', 40), ('kbt', 'Klinik Bilimler Testi', 80)]
NUM = re.compile(r'^\s*(\d{1,2})\s*[.﴿)]')
KEY = re.compile(r'^(\d{1,2})\.$')
# Açıklama sayfalarındaki numaralı maddeler soru sanılmasın
INSTR = re.compile(r'^\s*\d{1,2}\s*[.)]\s*(Bu (test|kitap|b[öo]l[üu]m)|Cevap|S[ıi]nav|Testlerin|Her soru|Soru kitap|Kitap[çc][ıi]k|Puanlama|Yan[ıi]tlar)', re.I)
FOOT = re.compile(r'Di[ğg]er sayfaya|TEST(İ|I)? B[İI]TT|TEST[İI]NE GE[ÇC]|telif haklar|hi[çc]bir ki[şs]i|^\s*\d+\s*$|^\s*\d{4}-DUS', re.I)

sys.stdout.reconfigure(encoding='utf-8')


def title_of(name):
    m = re.match(r'(\d{4})(?:-(ilkbahar|sonbahar))?', name)
    y, d = m.group(1), m.group(2)
    # 2015'te tek sınav yapıldı (dosya adı 'sonbahar'); 2020 sınavı Mart 2021'de
    t = f'{y} DUS' + (f" {'İlkbahar' if d == 'ilkbahar' else 'Sonbahar'}" if d and y != '2015' else '')
    return (t + ' (Mart 2021)') if y == '2020' else t


def answer_key(doc):
    """Son sayfalardaki cevap anahtarı: 'N.' kelimesi ve hemen sağındaki harf. Sütunlar soldan sağa, sayfa sırasıyla;
    numara 1'e dönünce yeni test başlar."""
    cols = []  # (page, x, [(n, ans)])
    for pi in range(max(0, len(doc) - 4), len(doc)):
        words = doc[pi].get_text('words')
        pairs = []
        for w in words:
            glued = re.match(r'^(\d{1,2})\.([A-E]|[İI]ptal|[İI]PTAL)$', w[4])  # "62.İptal"
            if glued:
                a = glued.group(2)
                pairs.append((pi, w[0], w[1], int(glued.group(1)), a if len(a) == 1 else 'X'))
                continue
            m = KEY.match(w[4])
            if not m:
                continue
            # aynı satırda sağdaki ilk kelime
            right = [v for v in words if abs(v[1] - w[1]) < 3 and 0 < v[0] - w[2] < 40]
            if not right:
                continue
            right.sort(key=lambda v: v[0])
            a = right[0][4].upper().replace('İ', 'I')
            if a in 'ABCDE' and len(a) == 1:
                pairs.append((pi, w[0], w[1], int(m.group(1)), a))
            elif a.startswith('IPTAL'):
                pairs.append((pi, w[0], w[1], int(m.group(1)), 'X'))
        # sütunlara ayır (x yakınlığı)
        for p in sorted(pairs, key=lambda p: (round(p[1] / 25), p[2])):
            for c in cols:
                if c[0] == pi and abs(c[1] - p[1]) < 25:
                    c[2].append((p[3], p[4], p[2]))
                    break
            else:
                cols.append([pi, p[1], [(p[3], p[4], p[2])]])
    cols.sort(key=lambda c: (c[0], c[1]))
    tests, cur = [], {}
    for c in cols:
        for n, a, _ in sorted(c[2], key=lambda t: t[2]):
            if n == 1 and cur:
                tests.append(cur)
                cur = {}
            cur[n] = a
    if cur:
        tests.append(cur)
    # Yalnızca 40 ve 80 soruluk iki test
    tests = [t for t in tests if len(t) >= 30]
    return tests


def question_boxes(doc):
    """Sırayla beklenen numarayı arar: sütunun solundaki 'N.' blok başı. Numara 1'e dönünce ikinci test."""
    found = []  # (test_index, n, page, x0, y0, colx1)
    ti, expect = 0, 1
    for pi, page in enumerate(doc):
        W = page.rect.width
        blocks = sorted(page.get_text('blocks'), key=lambda b: (0 if b[0] < W / 2 else 1, b[1]))
        for b in blocks:
            m = NUM.match(b[4])
            if not m or b[0] > W * 0.6 or (b[0] > W * 0.12 and b[0] < W * 0.45):
                continue
            n = int(m.group(1))
            if INSTR.search(b[4]):
                continue
            if n == expect:
                found.append((ti, n, pi, b[0], b[1]))
                expect += 1
                if ti == 0 and expect > 40:
                    ti, expect = 1, 1
            elif n == 1 and ti == 0 and expect > 30:
                ti, expect = 1, 2
                found.append((ti, n, pi, b[0], b[1]))
    return found


WATERMARK = set()  # belgede 3'ten fazla sayfada tekrar eden görüntüler (filigran harfleri; içerik özetiyle)


def find_watermarks(doc):
    seen = {}
    for page in doc:
        for x in {r['digest'] for r in page.get_image_info(hashes=True)}:
            seen[x] = seen.get(x, 0) + 1
    WATERMARK.clear()
    WATERMARK.update(x for x, c in seen.items() if c > 3)


def figures(page):
    """Sorudaki şekiller; filigran (sayfa genişliğinde şeritler, tam sayfa görüntü, tekrar eden harfler) hariç."""
    W = page.rect.width
    return [r for r in page.get_image_info(hashes=True) if r['bbox'][2] - r['bbox'][0] <= 0.85 * W and r['digest'] not in WATERMARK]


def footer_y(page):
    H = page.rect.height
    ys = [b[1] for b in page.get_text('blocks') if b[1] > H * 0.85 and re.search(r'Di[ğg]er sayfaya|TEST B[İI]TT[İI]|^\s*\d+\s*$', b[4])]
    return min(ys) if ys else H * 0.94


def build(name, check):
    doc = pymupdf.open(os.path.join(SRC, name))
    find_watermarks(doc)
    keys = answer_key(doc)
    qs = question_boxes(doc)
    sid = name[:-4]
    out = {'id': sid, 'title': title_of(sid), 'year': int(sid[:4]), 'pages': [], 'tests': []}
    used_pages = sorted({q[2] for q in qs})
    page_no = {p: i + 1 for i, p in enumerate(used_pages)}
    for ti, (key, title, count) in enumerate(TESTS):
        items = [q for q in qs if q[0] == ti]
        ans = keys[ti] if ti < len(keys) else {}
        questions = []
        for j, (_, n, pi, x0, y0) in enumerate(items):
            page = doc[pi]
            W, H = page.rect.width, page.rect.height
            left = x0 < W / 2
            cx0, cx1 = (0.03 * W, 0.5 * W) if left else (0.5 * W, 0.97 * W)
            # aynı sütunda sonraki soru ya da sütun sonu
            nxt = [q for q in items[j + 1:] + [q for q in qs if q[0] != ti] if q[2] == pi and (q[3] < W / 2) == left and q[4] > y0]
            limit = min([q[4] for q in nxt], default=footer_y(page)) - 2
            # Kutu son yazının (şıklar) altında biter; şekiller şıklardan önce geldiği için içeride kalır
            ends = [b[3] for b in page.get_text('blocks') if b[1] >= y0 - 2 and b[3] <= limit + 1 and cx0 - 4 <= b[0] < cx1 and b[4].strip() and not FOOT.search(b[4])]
            ends += [r['bbox'][3] for r in figures(page) if r['bbox'][1] >= y0 - 2 and r['bbox'][3] <= limit + 1 and cx0 - 4 <= r['bbox'][0] < cx1]
            y1 = min(limit, max(ends, default=limit) + 10)
            if left:
                # Tek sütunlu sayfa ya da iki sütuna yayılan şekil: sağ kenar içeriğe göre genişler
                rights = [b[2] for b in page.get_text('blocks') if b[1] >= y0 - 2 and b[3] <= y1 and b[0] < W / 2 and b[4].strip() and not FOOT.search(b[4])]
                rights += [r['bbox'][2] for r in figures(page) if r['bbox'][1] >= y0 - 2 and r['bbox'][3] <= y1 + 1 and r['bbox'][0] < W / 2]
                cx1 = min(0.97 * W, max([cx1 - 6] + rights) + 6)
            top = max(0, y0 - 6)
            clip = pymupdf.Rect(cx0, top, cx1, y1)
            text = re.sub(r'\s+', ' ', page.get_text('text', clip=clip)).strip()
            questions.append({
                'n': n,
                'page': page_no[pi],
                'box': [round(cx0 / W, 4), round(top / H, 4), round(cx1 / W, 4), round(y1 / H, 4)],
                'answer': ans.get(n, ''),
                'text': text[:600],
            })
        out['tests'].append({'key': key, 'title': title, 'questions': questions})
    miss = [(t['key'], len(t['questions']), sum(1 for q in t['questions'] if not q['answer'])) for t in out['tests']]
    print(f'{sid}: anahtar {[len(k) for k in keys]}, sorular {miss}')
    if check:
        return
    d = os.path.join(OUT, sid)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.endswith('.webp'):
            os.remove(os.path.join(d, f))
    for pi in used_pages:
        pix = doc[pi].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE))
        out['pages'].append({'w': pix.width, 'h': pix.height})
        pix.pil_save(os.path.join(d, f'p{page_no[pi]:03d}.webp'), format='WEBP', quality=72)
    with open(os.path.join(d, 'sinav.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)


if __name__ == '__main__':
    check = '--kontrol' in sys.argv
    for name in sorted(os.listdir(SRC)):
        if name.endswith('.pdf') and 'yuzde10' not in name:
            build(name, check)
