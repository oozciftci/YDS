"""İndirilen kitap dosyasından (DOCX, EPUB, PDF, TXT) düz metin çıkarır: başlıklar '# ' ile, paragraflar boş satırla.
Kullanım: python -I scripts/okuma/metin_cikar.py <dosya> <çıktı.txt>
Okuma kitabına dönüştürme: scripts/okuma/kitap_yap.mjs"""
import html
import re
import sys
import zipfile


def docx(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf8')
    out = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        text = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', p))
        text = html.unescape(text).strip()
        if not text:
            continue
        style = re.search(r'<w:pStyle w:val="([^"]+)"', p)
        heading = style and re.match(r'(Heading|Title|Başlık)', style.group(1), re.I)
        out.append(('# ' if heading else '') + text)
    return out


def epub(path):
    z = zipfile.ZipFile(path)
    opf_name = re.search(r'full-path="([^"]+)"', z.read('META-INF/container.xml').decode('utf8')).group(1)
    opf = z.read(opf_name).decode('utf8')
    base = opf_name.rsplit('/', 1)[0] + '/' if '/' in opf_name else ''
    items = dict(re.findall(r'<item [^>]*id="([^"]+)"[^>]*href="([^"]+)"', opf))
    items.update({k: v for v, k in re.findall(r'<item [^>]*href="([^"]+)"[^>]*id="([^"]+)"', opf)})
    out = []
    for idref in re.findall(r'<itemref [^>]*idref="([^"]+)"', opf):
        doc = z.read(base + items[idref]).decode('utf8', 'ignore')
        body = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', doc, flags=re.S)
        for tag, inner in re.findall(r'<(h[1-6]|p|li)[^>]*>(.*?)</\1>', body, re.S):
            text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', inner))).strip()
            if text:
                out.append(('# ' if tag.startswith('h') else '') + text)
    return out


def pdf(path):
    """Satır satır: boş satır paragrafı bitirir; sayfa sonu paragrafı bölmez. Üst/alt bilgi ve sayfa numaraları atlanır."""
    import pymupdf
    out, cur = [], []

    def flush():
        if cur:
            out.append(re.sub(r'\s+', ' ', ' '.join(cur)).strip())
            cur.clear()

    for page in pymupdf.open(path):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                t = ''.join(span['text'] for span in line['spans']).strip()
                if not t:
                    flush()
                elif t.startswith('file:///') or re.fullmatch(r'\d{1,4}', t):
                    continue
                else:
                    cur.append(t)
            # Blok sonu da paragraf sonu sayılır (satır aralığı olmayan PDF'lerde)
            if len(block.get('lines', [])) > 1 and block.get('lines'):
                last = ''.join(s['text'] for s in block['lines'][-1]['spans']).strip()
                if last.endswith(('.', '?', '!', '"', '”', ':')):
                    flush()
    flush()
    return [p for p in out if p]


def fix_quotes(t):
    """Bazı PDF'lerde tırnak/kesme/uzun çizgi U+FFFD olarak gelir: bağlamdan tahmin edilir."""
    if '�' not in t:
        return t
    t = re.sub(r"(?<=[A-Za-z])�(?=(s|t|ll|re|ve|d|m))", '’', t)
    t = re.sub(r'(?<=[A-Za-z?!,.])�(?=[A-Za-z])', '—', t)
    t = re.sub(r'(^|(?<=[\s(—]))�', '“', t)
    return t.replace('�', '”')


def txt(path):
    raw = open(path, encoding='utf8', errors='ignore').read()
    return [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', raw) if p.strip()]


src, dst = sys.argv[1], sys.argv[2]
ext = src.lower().rsplit('.', 1)[-1]
paras = [fix_quotes(p) for p in {'docx': docx, 'epub': epub, 'pdf': pdf, 'txt': txt}[ext](src)]
open(dst, 'w', encoding='utf8').write('\n\n'.join(paras) + '\n')
print(f'{src}: {len(paras)} paragraf, {sum(len(p.split()) for p in paras)} kelime')
