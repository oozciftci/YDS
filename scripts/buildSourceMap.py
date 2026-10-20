# Koç modu için kaynak haritası: "Sınav Stratejileri 1-2" kitabının içindekilerinden (OCR oturumunun çıkardığı
# icindekiler.json) soru tipi / dilbilgisi konusu → sayfa aralığı eşlemesi üretir ve local-data/kaynaklar/harita.json'a
# yazar (diğer kitapların kayıtları korunur). Yapay zekâ bir soruyu açıklarken ilgili bölümün ilk sayfalarını kaynak alır.
#
# Kullanım: python scripts/buildSourceMap.py
import json
import os

DIR = 'local-data/kaynaklar'
BOOK = 'sinav-stratejileri-12'
TOC = os.path.join(DIR, BOOK, 'icindekiler.json')
MAP = os.path.join(DIR, 'harita.json')

# Bölüm başlığındaki anahtar → (soru tipleri, grammar.ts konu id'leri)
RULES = [
    ('TENSE', ['grammar', 'cloze'], ['zamanlar']),
    ('MODALITY', ['grammar', 'cloze'], ['kipler']),
    ('PASSIVE', ['grammar', 'cloze'], ['edilgen']),
    ('GERUNDS', ['grammar', 'cloze'], ['ing-to']),
    ('ADJECTIVES & ADVERBS', ['grammar'], ['karsilastirma']),
    ('ADJECTIVAL CLAUSES', ['grammar', 'completion'], ['sifat-cumlesi']),
    ('NOUN CLAUSES', ['grammar', 'completion'], ['isim-cumlesi']),
    ('CONDITIONALS', ['grammar', 'completion'], ['kosul']),
    ('CONJUNCTIONS', ['grammar', 'completion', 'cloze'], ['baglaclar', 'gecis-ifadeleri', 'cift-baglac', 'devrik']),
    ('QUANTIFIERS', ['grammar'], ['miktar']),
    ('CLOZE', ['cloze'], []),
    ('CÜMLE TAMAMLAMA', ['completion'], []),
    ('İNGİLİZCE-TÜRKÇE', ['translation'], []),
    ('TÜRKÇE-İNGİLİZCE', ['translation'], []),
    ('PARAGRAF TAMAMLAMA', ['paragraph'], []),
    ('ANLAM BÜTÜNLÜĞÜNÜ', ['irrelevant'], []),
    ('KARŞILIKLI KONUŞMA', ['dialogue'], []),
    ('YAKIN ANLAMLI', ['paraphrase'], []),
    ('OKUMA PARÇASI', ['reading'], []),
]


def main():
    toc = json.load(open(TOC, encoding='utf-8'))
    pages_done = len([f for f in os.listdir(os.path.join(DIR, BOOK)) if f.startswith('sayfa-')])
    entries = []
    for b in toc['bolumler']:
        if b['tur'] != 'konu':
            continue
        title = b['baslik'].upper()
        rule = next((r for r in RULES if r[0] in title), None)
        if not rule:
            continue
        entries.append({'book': BOOK, 'from': b['pdfBaslangic'], 'to': b['pdfBitis'], 'title': b['baslik'],
                        'sections': rule[1], 'grammar': rule[2]})
    old = json.load(open(MAP, encoding='utf-8')) if os.path.exists(MAP) else {'books': [], 'entries': []}
    books = [x for x in old['books'] if x['id'] != BOOK] + [
        {'id': BOOK, 'title': 'Sınav Stratejileri 1-2', 'author': 'Suat Gürcan & Rıdvan Gürbüz', 'pages': pages_done}]
    keep = [e for e in old['entries'] if e['book'] != BOOK]
    json.dump({'books': books, 'entries': keep + entries}, open(MAP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(entries)} bölüm haritaya eklendi; OCR\'lı sayfa: {pages_done}')


main()
