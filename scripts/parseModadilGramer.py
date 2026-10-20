# MODADİL "YDS Çözümlü Modüler Soru Bankası 2 — Tüm Gramer Konuları" PDF'inden (taranmış, OCR metinli)
# 20 gramer testini (25'er soru) ve kitabın çözümlerini yerel sınav verisine çevirir.
# Çıktı YALNIZCA yerelde kalır: local-data/yds/banka-grammar-modadil-NN.json (git'e ve yayına girmez; telifli).
#
# Kullanım: python scripts/parseModadilGramer.py [pdf]
# Gerekenler: pdftotext (xpdf/poppler), pypdf
import json
import os
import re
import subprocess
import sys
import tempfile

PDF = sys.argv[1] if len(sys.argv) > 1 else 'cikmis_sorular/modadil-soru-bankasi-2.pdf'
OUT = 'local-data/yds'
PDF_NAME = os.path.basename(PDF)
# Testlerin ilk soru sayfaları (PDF sayfa no); her testin 3 soru sayfası var, ardından çözümler gelir
TEST_STARTS = [6, 17, 27, 37, 48, 58, 67, 77, 89, 99, 109, 118, 128, 138, 147, 157, 167, 177, 187, 196]
LAST_PAGE = 203
PAGE_W = 549


def build_vocab():
    """o/a gibi OCR karışıklıklarını düzeltmek için yereldeki çıkmış sınav metinlerinden kelime listesi."""
    words = set()
    for f in os.listdir(OUT):
        if f.endswith('.json') and not f.startswith('banka-') and not f.endswith('.tr.json'):
            with open(os.path.join(OUT, f), encoding='utf-8') as fh:
                words.update(w.lower() for w in re.findall(r'[A-Za-z]+', fh.read()))
    return words


VOCAB = build_vocab()
# Sayfa düzeni yüzünden otomatik ayrıştırılamayan sorular, PDF'ten elle (yerel, telifli)
FIX_FILE = os.path.join(OUT, '_eksik', 'modadil_duzeltmeler.json')
FIXES = json.load(open(FIX_FILE, encoding='utf-8')) if os.path.exists(FIX_FILE) else {}
SWAPS = [('a', 'o'), ('o', 'a'), ('l', 'i'), ('i', 'l'), ('c', 'e'), ('e', 'c'), ('rn', 'm'), ('t', 'f')]


def fix_word(m):
    """Sözlükte olmayan kelimede tek tip harf karışıklığını dener (wauld → would, gane → gone)."""
    w = m.group(0)
    lw = w.lower()
    if len(lw) < 2 or lw in VOCAB:
        return w
    for a, b in SWAPS:
        idx = [i for i in range(len(lw)) if lw.startswith(a, i)]
        for c in [lw.replace(a, b)] + [lw[:i] + b + lw[i + len(a):] for i in idx]:
            if c in VOCAB:
                return c if w.islower() else c[:1].upper() + c[1:]
    return w


def pdftext(page, *margins):
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as f:
        out = f.name
    subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', '-f', str(page), '-l', str(page), *margins, PDF, out], check=True)
    with open(out, encoding='utf-8') as fh:
        t = fh.read()
    os.unlink(out)
    return t


def columns(page):
    """İki sütunlu soru sayfası: tam satır düzeninde sütun arasını (en az satırın kesiştiği sütun) bulup böler."""
    lines = pdftext(page).split('\n')
    width = max((len(l) for l in lines), default=120)
    mid = width // 2
    best = None
    for c in range(mid - 18, mid + 12):
        cross = sum(1 for l in lines if len(l) > c and l[c - 1] != ' ' and l[c] != ' ')
        score = (cross, abs(c - mid))
        if best is None or score < best[0]:
            best = (score, c)
    c = best[1]
    # Sınırın biraz soluna taşan satırlarda en yakın boşluktan böl
    left, right = [], []
    for l in lines:
        k = c
        while 0 < k < len(l) and l[k - 1] != ' ':
            k -= 1
        left.append(l[:k].rstrip())
        right.append(l[k:].strip() if len(l) > k else '')
    return '\n'.join(left) + '\n' + '\n'.join(right)


def fix_letter(c):
    return {'8': 'B', 'O': 'D', '0': 'D', 'o': 'D'}.get(c, c)


def num_re(n):
    """OCR'da '1 3.' gibi araya boşluk giren soru numarası."""
    alt = {'0': '[0O]', '1': '[1lI]', '8': '[8B]'}
    return r'\s?'.join(alt.get(d, d) for d in str(n))


BLANK = re.compile(r'(?:[-–—·•.­]\s?){2,}|•+|·+')


def clean_q(s):
    s = s.replace('­', '')
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', ' ', s).strip()
    # Boşluk işaretleri ('••••', '-·-', '·---' …) → '----'
    s = re.sub(r'(?<![A-Za-z])(?:[-–—·•]\s?){2,}[-–—·•]?', '----', s)
    s = re.sub(r'(----\s*)+', '---- ', s).replace('---- .', '----.').replace('---- ,', '----,')
    s = re.sub(r'----\s+([.,;:?!])', r'----\1', s)
    # Sık OCR karışıklıkları
    s = re.sub(r'\bfı', 'fi', s)
    s = s.replace('ı', 'i') if not re.search(r'[ğşçöüİ]', s) else s
    s = re.sub(r'\btor\b', 'for', s)
    s = re.sub(r'(^|\. )it\b', lambda m: m.group(1) + 'It', s)
    s = re.sub(r'(^|\. )in\b', lambda m: m.group(1) + 'In', s)
    s = re.sub(r'\bl([A-Z])', r'I\1', s)
    # 'lf', 'lndia', 'ltalian', 'lstanbul': büyük I yerine küçük l
    s = re.sub(r'\bl(?=[fnmts][a-z]*\b)', 'I', s)
    # '1 wish 1' → 'I wish I'
    s = re.sub(r'(?<![\d,.])\b1\b(?=\s+[a-z])|(?<=[a-z] )1\b(?![\d,.])', 'I', s)
    # '1 980s', '200 1' → bölünmüş sayılar
    s = re.sub(r'(?<=\d) (?=\d)', '', s)
    s = re.sub(r'\bI (?=\d{3}\b)', '1', s)
    s = re.sub(r'\bi n\b', 'in', s)
    s = re.sub(r'[A-Za-z]+', fix_word, s)
    s = re.sub(r'\bta\b', 'to', s)
    # Araya boşluk girmiş kelime: 'd ismissed', 'si licon'
    s = re.sub(r'\b([A-Za-z]{1,3}) ([a-z]{2,})\b', join_split, s)
    return s.strip()


def join_split(m):
    a, b = m.group(1), m.group(2)
    whole = (a + b).lower()
    if whole in VOCAB and (a.lower() not in VOCAB or b.lower() not in VOCAB):
        return a + b
    return m.group(0)


def parse_questions(text):
    # Başlık, yönerge ve sayfa numaralarını at
    text = re.sub(r'G\s?R\s?A\s?M\s?E\s?R', '', text)
    text = re.sub(r'(?m)^\s*\d{1,3}\s*$', '', text)
    text = re.sub(r'1\s?\.?.{0,12}2\s?5\s?\.?\s*s\s?o\s?r\s?u.*?b\s?u\s?l\s?u\s?n\s?u\s?z\s?\.', '', text, flags=re.S)
    qs = {}
    pos = 0
    starts = []
    for n in range(1, 26):
        # Satır başında ya da (sütun bölmesi kayınca) geniş boşluktan sonra gelen numara
        # (Yönergedeki "1. - 25." soru 1 sanılmasın)
        m = re.compile(r"(?m)(?:^[ \t]*|[ \t]{3,})['‘’`]?\s?" + num_re(n) + r'\s?\.\s(?![\s\-–·•.,:]*2\s?5)').search(text, pos)
        if not m:
            starts.append(None)
            continue
        starts.append(m)
        pos = m.end()
    for i, m in enumerate(starts):
        if m is None:
            continue
        nxt = next((x for x in starts[i + 1:] if x is not None), None)
        body = text[m.end(): nxt.start() if nxt else len(text)]
        qs[i + 1] = split_options(body)
    return qs


def split_options(body):
    marks = {'A': r'A', 'B': r'[B8]', 'C': r'C', 'D': r'[DO0]', 'E': r'E'}
    pos = 0
    found = []
    for L in 'ABCDE':
        m = re.compile(r'(?<![A-Za-z])' + marks[L] + r'\s?[)}\]]').search(body, pos)
        # OCR son şıkkı bazen ikinci bir "A)" olarak okuyor
        if not m and L == 'E':
            m = re.compile(r'(?<![A-Za-z])A\s?[)}\]]').search(body, pos)
        if not m:
            return None
        found.append((L, m))
        pos = m.end()
    stem = clean_q(body[: found[0][1].start()])
    # Boşluk tek '-' olarak okunmuşsa
    stem = re.sub(r'(^|\s)[-–—](?=\s)', r'\1----', stem)
    opts = {}
    for k, (L, m) in enumerate(found):
        end = found[k + 1][1].start() if k + 1 < len(found) else len(body)
        o = clean_q(body[m.end(): end])
        # Şıkkın sonuna yapışan sayfa numarası
        o = re.sub(r'\s+\d[\d ]*$', '', o).strip()
        # İki boşluklu sorularda şıklar "x / y": OCR '/' yerine 'I' ya da 'J' okuyabiliyor
        if stem.count('----') >= 2:
            o = re.sub(r'\s+[I|lJjı]\s+', ' / ', o)
            o = re.sub(r'\s*/\s*', ' / ', o)
        opts[L] = o
    return {'stem': stem, 'options': opts}


def parse_solutions(text):
    text = re.sub(r'G\s?R\s?A\s?M\s?E\s?R', '', text)
    text = re.sub(r'(?m)^\s*\d{1,3}\s*$', '', text)
    sols = {}
    pos = 0
    hits = []
    for n in range(1, 26):
        m = re.compile(r'(?m)(?:^|(?<=\s))' + num_re(n) + r'\s?\.\s?([A-E8O0])\b').search(text, pos)
        if not m:
            hits.append(None)
            continue
        hits.append(m)
        pos = m.end()
    for i, m in enumerate(hits):
        if m is None:
            continue
        nxt = next((x for x in hits[i + 1:] if x is not None), None)
        body = text[m.end(): nxt.start() if nxt else len(text)]
        body = re.sub(r'[ \t]+', ' ', body)
        body = re.sub(r'\s*\n\s*\n\s*', '\n\n', body)
        body = re.sub(r'(?<!\n)\n(?!\n)', ' ', body).strip()
        body = re.sub(r'[ \t]{2,}', ' ', body)
        body = re.sub(r'\bl([fn])\b', r'I\1', body)
        sols[i + 1] = {'answer': fix_letter(m.group(1)), 'explain': body}
    return sols


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    for t, start in enumerate(TEST_STARTS, 1):
        end = (TEST_STARTS[t] - 1) if t < len(TEST_STARTS) else LAST_PAGE
        qpages = [start, start + 1, start + 2]
        qtext = ''
        qpage_of = {}
        for p in qpages:
            col = columns(p)
            qtext += '\n' + col
        qs = parse_questions(qtext)
        # Sorunun bulunduğu PDF sayfası: soru metninin ilk kelimeleri hangi sayfada geçiyor
        page_texts = {p: ' '.join(pdftext(p).split()) for p in qpages}
        stext = '\n'.join(pdftext(p) for p in range(start + 3, end + 1))
        sols = parse_solutions(stext)
        questions = []
        for n in range(1, 26):
            q = qs.get(n)
            s = sols.get(n)
            fix = FIXES.get(f'{t}-{n}')
            if fix:
                q = {'stem': fix['stem'], 'options': dict(zip('ABCDE', fix['options']))}
            if not q:
                report.append(f'Test {t} soru {n}: ayrıştırılamadı')
                continue
            probe = ' '.join(q['stem'].replace('----', ' ').split()[:3])
            page = next((p for p, pt in page_texts.items() if probe and probe in pt), qpages[0])
            qid = f'q{n}'
            questions.append({
                'no': n,
                'page': page,
                'passage': None,
                'stem': [{'id': f'{qid}.s1', 'en': q['stem']}],
                'options': {L: {'id': f'{qid}.{L}', 'en': v} for L, v in q['options'].items()},
                'answer': s['answer'] if s else None,
                'explain': s['explain'] if s else None,
            })
            if not s:
                report.append(f'Test {t} soru {n}: çözüm/cevap bulunamadı')
        exam = {
            'id': f'banka-grammar-modadil-{t:02d}',
            'title': f'MODADİL Gramer Testi {t}',
            'kind': 'yds',
            'bank': 'grammar',
            'pdf': PDF_NAME,
            'pageFrom': start,
            'pageTo': end,
            'passages': [],
            'questions': questions,
        }
        with open(os.path.join(OUT, exam['id'] + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(exam, fh, ensure_ascii=False, indent=1)
        print(f'Test {t:2d}: {len(questions)} soru, {sum(1 for q in questions if q["answer"])} cevaplı')
    print('\n'.join(report) or 'Eksik yok')


main()
