"""Windows OCR'ın (yalnızca Türkçe dil paketi kuruluysa) İngilizce metinde yaptığı tipik hataları düzeltir ve satırları
paragraflara birleştirir: ı/İ karışması, sayfa başlıkları, satır sonu tireleri. Çıktı metin_cikar.py ile aynı biçimdedir
(paragraflar boş satırla, başlıklar '# ').
Kullanım: python -I scripts/okuma/ocr_duzelt.py <ocr.txt> <metin.txt> [ilk_sayfa]"""
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
first = int(sys.argv[3]) if len(sys.argv) > 3 else 1
pages = re.split(r'^=== p(\d+)\.png\s*$', open(src, encoding='utf-8-sig').read(), flags=re.M)
lines = []
for no, body in zip(pages[1::2], pages[2::2]):
    if int(no) < first:
        continue
    for ln in body.splitlines():
        t = ln.strip()
        if not t or re.fullmatch(r'\d{1,3}', t):
            continue
        t = t.replace('İ', 'I')
        t = re.sub(r'(?<=[A-Za-z])ı|ı(?=[A-Za-z])', 'l', t)  # Leveıs → Levels
        t = t.replace('ı', '1')
        t = re.sub(r'\bT itle', 'Title', t)
        t = re.sub(r'\b([A-Z]) (?=[a-z]{2,})', r'\1', t)  # "J oni" → "Joni"
        lines.append(t)
    lines.append('')  # sayfa sonu: paragraf sınırı olabilir

# Satırları paragraflara birleştir: cümle sonuyla biten satırdan sonra kısa satır ya da boş satır paragrafı bitirir
paras, cur = [], []
for t in lines:
    if not t:
        if cur and re.search(r'[.!?\'"’”]$', cur[-1]):
            paras.append(' '.join(cur)); cur = []
        continue
    if cur and cur[-1].endswith('-'):
        cur[-1] = cur[-1][:-1] + t
    else:
        cur.append(t)
    if re.search(r'[.!?\'"’”]$', t) and len(t) < 38:
        paras.append(' '.join(cur)); cur = []
if cur:
    paras.append(' '.join(cur))
text = '\n\n'.join(paras)
# Sözcük düzeyi: "Ido" → "I do", tek başına "1" → "I", Türkçe harfler, tırnaklar
text = re.sub(r"\bI(?=(do|did|can|could|am|was|will|would|have|had|think|know|want|like|love|must|need|hope|see|feel|said|shall|should|don't|didn't|can't|wasn't)\b)", 'I ', text)
text = re.sub(r'(?<=[\s"])1(?= [a-z])', 'I', text)
# Cümle ortasında yanlışlıkla büyük harfle okunan sık sözcükler ("Joni and She were", "I Will")
text = re.sub(r"(?<=[a-z,;] )(Will|She|He|They|We|It|The|And|But|Was|Were|Is|Are|Class|His|Her)\b", lambda m: m.group(1).lower(), text)
text = re.sub(r"(?<=\bI )(Will|Was|Am|Can|Do)\b", lambda m: m.group(1).lower(), text)
text = text.translate(str.maketrans('şŞğĞçÇöÖüÜ', 'sSgGcCoOuU'))
text = re.sub(r'[“”]', '"', text).replace('’', "'")
open(dst, 'w', encoding='utf-8').write(text + '\n')
print(f'{len(paras)} paragraf, {sum(len(p.split()) for p in paras)} kelime')
