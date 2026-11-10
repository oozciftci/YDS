# DUS terim sözlüğü için yardımcı ve denetleyici. Görev tanımı: docs/antigravity/DUS_SOZLUK_GOREVI.md.
# Yazılan parçalar: local-data/dus/sozluk/parcalar/<sınav>/NNN.json (her parti ayrı dosya).
# Denetim hatasızsa parçalar local-data/dus/sozluk/<sınav>.json dosyasında birleştirilir (uygulama onu okur).
# Yalnızca standart kütüphane; bunun dışında hiçbir dosyaya yazmaz.
#
#   python scripts/dus/sozluk_denetle.py --durum                    sınav başına ilerleme
#   python scripts/dus/sozluk_denetle.py --sonraki 2014-ilkbahar    sıradaki 10 sorunun metni (sözlüğü olmayanlar)
#   python scripts/dus/sozluk_denetle.py --sonraki 2014-ilkbahar --adet 5
#   python scripts/dus/sozluk_denetle.py --parca 2014-ilkbahar      sıradaki parça dosyasının yolu
#   python scripts/dus/sozluk_denetle.py 2014-ilkbahar               o sınavın parçalarını denetler (+ birleştirir)
#   python scripts/dus/sozluk_denetle.py --hepsi                     bütün sözlük dosyalarını denetler
#   python scripts/dus/sozluk_denetle.py --sizinti [2014-ilkbahar]   cevabı ele veriyor olabilecek kayıtlar
# Düzeltme turu (docs/antigravity/DUS_SOZLUK_DUZELTME.md): --sonraki/--parca komutlarına --duzeltme eklenir;
# düzeltilmiş kayıtlar dNNN.json parçalarına yazılır ve eski parçalardaki kaydın yerine geçer.
#   python scripts/dus/sozluk_denetle.py --dosya docs/antigravity/dus_sozluk_ornek.json
import argparse
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OCR = os.path.join(KOK, 'local-data', 'dus', 'ocr')
SOZLUK = os.path.join(KOK, 'local-data', 'dus', 'sozluk')

# Ders sırası ve soru sayıları (src/services/dus.ts ile aynı)
DERSLER = {
    'tbt': [('Anatomi', 6), ('Histoloji ve Embriyoloji', 4), ('Fizyoloji', 6), ('Biyokimya', 6), ('Mikrobiyoloji', 6),
            ('Patoloji', 4), ('Farmakoloji', 4), ('Biyoloji ve Genetik', 4)],
    'kbt': [('Restoratif Diş Tedavisi', 10), ('Protetik Diş Tedavisi', 10), ('Ağız, Diş ve Çene Cerrahisi', 10),
            ('Ağız, Diş ve Çene Radyolojisi', 10), ('Periodontoloji', 10), ('Ortodonti', 10), ('Endodonti', 10),
            ('Pedodonti', 10)],
}

SIZINTI = re.compile(
    r'doğru (cevap|yanıt|şık|seçenek)|yanlış (şık|seçenek)|cevab?ı?\s*[A-E]\b|\b[A-E]\)?\s*şıkkı|şıkkı (doğru|yanlış)'
    r'|bu yüzden cevap|cevap olarak',
    re.I,
)


def ders(anahtar):
    test, no = anahtar.split('/')
    n = int(no)
    for ad, adet in DERSLER[test]:
        if n <= adet:
            return ad
        n -= adet
    return '?'


def sinavlar():
    return sorted(f[:-5] for f in os.listdir(OCR) if f.endswith('.json'))


def sirala(anahtarlar):
    return sorted(anahtarlar, key=lambda k: (k.split('/')[0] != 'tbt', int(k.split('/')[1])))


def oku(yol):
    with open(yol, encoding='utf-8') as f:
        return json.load(f)


def sorular(sinav):
    """{anahtar: {soru, siklar, sekil}} — OCR metni boş olan sorular atlanır."""
    d = oku(os.path.join(OCR, sinav + '.json'))
    return {k: v for k, v in d.items() if v.get('soru', '').strip()}


def sozluk_yolu(sinav):
    return os.path.join(SOZLUK, sinav + '.json')


def parca_dizini(sinav):
    return os.path.join(SOZLUK, 'parcalar', sinav)


def parcalar(sinav):
    d = parca_dizini(sinav)
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.json')) if os.path.isdir(d) else []


def sozluk(sinav):
    """Parçaların birleşimi (aynı soru iki parçada varsa sonraki geçerli). Okunamayan parça atlanır."""
    out = {'sinav': sinav, 'surum': 1, 'sorular': {}}
    for yol in parcalar(sinav):
        try:
            out['sorular'].update(oku(yol).get('sorular', {}))
        except Exception:
            pass
    return out


def sonraki_parca(sinav, duzeltme=False):
    on = 'd' if duzeltme else ''
    nolar = [int(m.group(1)) for y in parcalar(sinav) if (m := re.match(on + r'(\d+)\.json$', os.path.basename(y)))]
    return os.path.join(parca_dizini(sinav), f'{on}{(max(nolar) if nolar else 0) + 1:03}.json')


def duzeltilenler(sinav):
    """Düzeltme turunda (dNNN.json parçaları) yeniden yazılmış soru anahtarları."""
    out = set()
    for yol in parcalar(sinav):
        if os.path.basename(yol).startswith('d'):
            try:
                out |= set(oku(yol).get('sorular', {}))
            except Exception:
                pass
    return out


# --- Cevap sızıntısı (kaba ölçü): cevap anahtarı yalnızca burada, içeride okunur -------------------------------

_cevaplar = {}


def cevaplar(sinav):
    if sinav not in _cevaplar:
        sj = oku(os.path.join(KOK, 'local-data', 'dus', 'sinavlar', sinav, 'sinav.json'))
        _cevaplar[sinav] = {f"{t['key']}/{q['n']}": q.get('answer') for t in sj['tests'] for q in t['questions']}
    return _cevaplar[sinav]


GENEL = {'aşağı', 'hangi', 'değil', 'olara', 'yukar', 'ifade', 'doğru', 'yanlı', 'tedav', 'hasta', 'göre', 'olan',
         'için', 'daha', 'sonr', 'olma', 'ile', 'veya', 'gibi', 'bulu', 'kull', 'yapı', 'neden'}


def _kel(t):
    t = t.replace('İ', 'i').replace('I', 'ı').lower()
    return {w[:5] for w in re.findall(r'[a-zçğıöşüâîû0-9]+', t) if len(w) >= 4} - GENEL


def sizinti(sinav, k, kayit, q):
    """Kökteki terimlerin açıklaması ya da neSoruyor cevabı ele veriyor mu? Şık terimleri sayılmaz (uygulamada
    cevaptan önce kilitli). Döndürür: açıklama listesi (boş = temiz)."""
    a = cevaplar(sinav).get(k)
    if not a or a not in 'ABCDE':
        return []
    kok = _kel(q['soru'])
    sik = {h: _kel(q.get('siklar', {}).get(h, '')) - kok for h in 'ABCDE'}
    ortak = set.intersection(*sik.values()) if all(sik.values()) else set()
    dogru = sik[a] - ortak - set().union(*[sik[h] for h in 'ABCDE' if h != a])
    yanlis = [sik[h] - ortak - sik[a] for h in 'ABCDE' if h != a]
    out = []
    for t in kayit.get('terimler', []):
        if not isinstance(t, dict) or t.get('metin', '') not in q['soru']:
            continue
        w = _kel(f"{t.get('kisa', '')} {t.get('aciklama', '')} {t.get('koken', '')}")
        if dogru and dogru & w and dogru <= w | kok:
            out.append(f'kök terimi "{t["metin"]}": açıklaması doğru şıkkın içeriğini söylüyor')
        elif sum(1 for y in yanlis if y and y & w) >= 3:
            out.append(f'kök terimi "{t["metin"]}": açıklaması şıkları sıralıyor (eleme yoluyla cevabı veriyor)')
    ns = _kel(kayit.get('neSoruyor', ''))
    if dogru and dogru & ns and dogru <= ns | kok:
        out.append('neSoruyor: doğru şıkkın içeriğini söylüyor')
    elif sum(1 for y in yanlis if y and y & ns) >= 3:
        out.append('neSoruyor: şıkları sıralıyor')
    return out


def sizinti_listesi(hedef):
    toplam = 0
    for s in [hedef] if hedef else sinavlar():
        qs = sorular(s)
        for k, kayit in sozluk(s)['sorular'].items():
            if k in qs:
                for m in sizinti(s, k, kayit, qs[k]):
                    toplam += 1
                    print(f'SIZINTI? {s} {k} · {m}')
    print(f'{toplam} olası sızıntı')


def tam_metin(q):
    return q['soru'] + '\n' + '\n'.join(q.get('siklar', {}).get(h, '') for h in 'ABCDE')


def durum():
    toplam_b = toplam_t = toplam_d = 0
    for s in sinavlar():
        qs = sorular(s)
        try:
            biten = len(set(sozluk(s).get('sorular', {})) & set(qs))
            duz = len(duzeltilenler(s) & set(qs))
        except Exception as e:  # bozuk JSON
            print(f'{s:16} OKUNAMADI: {e}')
            continue
        toplam_b += biten
        toplam_t += len(qs)
        toplam_d += duz
        print(f'{s:16} {biten:4}/{len(qs):<4} {"✓" if biten == len(qs) else " "}   düzeltme {duz:4}/{len(qs):<4} {"✓" if duz == len(qs) else ""}')
    print(f'TOPLAM {toplam_b}/{toplam_t}   düzeltme {toplam_d}/{toplam_t}')


def sonraki(sinav, adet, duzeltme=False):
    qs = sorular(sinav)
    eski = sozluk(sinav).get('sorular', {})
    biten = duzeltilenler(sinav) if duzeltme else set(eski)
    kalan = [k for k in sirala(qs) if k not in biten]
    print(f'# {sinav}: {len(kalan)} soru kaldı{" (düzeltme turu)" if duzeltme else ""}. Sıradaki {min(adet, len(kalan))}:\n')
    for k in kalan[:adet]:
        q = qs[k]
        print(f'=== {k} · {ders(k)}{"  [ŞEKİLLİ SORU: metin eksik olabilir]" if q.get("sekil") else ""}')
        print(q['soru'])
        for h in 'ABCDE':
            print(f'{h}) {q.get("siklar", {}).get(h, "")}')
        if duzeltme and k in eski:
            print('--- MEVCUT KAYIT (ilk tur; yeniden yaz):')
            print(json.dumps(eski[k], ensure_ascii=False, indent=1))
            for m in sizinti(sinav, k, eski[k], q):
                print(f'!!! SIZINTI? {m}')
        print()


def denetle_veri(d, qs, etiket):
    hatalar, uyarilar = [], []
    if not isinstance(d, dict) or not isinstance(d.get('sorular'), dict):
        return [f'{etiket}: en üstte {{"sinav", "surum", "sorular": {{...}}}} olmalı'], []
    for k, kayit in d['sorular'].items():
        yer = f'{etiket} {k}'
        if k not in qs:
            hatalar.append(f'{yer}: böyle bir soru yok (anahtar "tbt/12" ya da "kbt/7" biçiminde olmalı)')
            continue
        metin = tam_metin(qs[k])
        if not isinstance(kayit, dict):
            hatalar.append(f'{yer}: kayıt bir nesne olmalı')
            continue
        fazla = set(kayit) - {'neSoruyor', 'terimler'}
        if fazla:
            hatalar.append(f'{yer}: bilinmeyen alan(lar): {", ".join(sorted(fazla))}')
        ns = kayit.get('neSoruyor')
        if not isinstance(ns, str) or not (15 <= len(ns) <= 300):
            hatalar.append(f'{yer}: "neSoruyor" 15–300 karakterlik bir cümle olmalı')
        elif SIZINTI.search(ns):
            hatalar.append(f'{yer}: "neSoruyor" cevabı ele veriyor olabilir: "{SIZINTI.search(ns).group(0)}"')
        terimler = kayit.get('terimler')
        if not isinstance(terimler, list) or not terimler:
            hatalar.append(f'{yer}: "terimler" boş olmayan bir liste olmalı')
            continue
        if len(terimler) > 20:
            uyarilar.append(f'{yer}: {len(terimler)} terim — fazla; yalnızca açıklama gerektirenleri al')
        gorulen = []
        for i, t in enumerate(terimler, 1):
            ty = f'{yer} terim {i}'
            if not isinstance(t, dict):
                hatalar.append(f'{ty}: nesne olmalı')
                continue
            fazla = set(t) - {'metin', 'terim', 'kisa', 'aciklama', 'koken'}
            if fazla:
                hatalar.append(f'{ty}: bilinmeyen alan(lar): {", ".join(sorted(fazla))}')
            m = t.get('metin')
            if not isinstance(m, str) or len(m.strip()) < 2:
                hatalar.append(f'{ty}: "metin" en az 2 karakter olmalı')
                continue
            ty = f'{yer} "{m}"'
            if m not in metin:
                hatalar.append(f'{ty}: soru/şık metninde BİREBİR geçmiyor (büyük-küçük harf, tire, kesme işareti dâhil)')
            if m != m.strip():
                hatalar.append(f'{ty}: "metin" başında/sonunda boşluk var')
            if m in gorulen:
                hatalar.append(f'{ty}: aynı soruda iki kez yazılmış')
            gorulen.append(m)
            for alan, enaz, encok in (('terim', 1, 80), ('kisa', 2, 60), ('aciklama', 30, 450)):
                v = t.get(alan)
                if not isinstance(v, str) or not (enaz <= len(v.strip()) <= encok):
                    hatalar.append(f'{ty}: "{alan}" {enaz}–{encok} karakter olmalı (şu an {len(v) if isinstance(v, str) else "yok"})')
            if 'koken' in t and (not isinstance(t['koken'], str) or len(t['koken']) > 120):
                hatalar.append(f'{ty}: "koken" en çok 120 karakterlik bir metin olmalı')
            for alan in ('kisa', 'aciklama', 'koken'):
                v = t.get(alan)
                if isinstance(v, str) and SIZINTI.search(v):
                    hatalar.append(f'{ty}: "{alan}" cevabı ele veriyor olabilir: "{SIZINTI.search(v).group(0)}"')
        for a in gorulen:
            for b in gorulen:
                if a != b and a in b:
                    uyarilar.append(f'{yer}: "{a}" başka bir terimin ("{b}") içinde geçiyor; ikisi gerçekten ayrı kavramsa sorun değil')
    return hatalar, uyarilar


def denetle_sinav(sinav):
    yollar = parcalar(sinav)
    if not yollar:
        print(f'{sinav}: henüz parça yok ({parca_dizini(sinav)})')
        return 0
    qs = sorular(sinav)
    hatalar, uyarilar, gorulen = [], [], {}
    for yol in yollar:
        ad = f'{sinav}/{os.path.basename(yol)}'
        try:
            d = oku(yol)
        except Exception as e:
            hatalar.append(f'{ad}: JSON OKUNAMADI — {e}')
            continue
        h, u = denetle_veri(d, qs, ad)
        if d.get('sinav') != sinav:
            h.append(f'{ad}: "sinav" alanı "{sinav}" olmalı')
        hatalar += h
        uyarilar += u
        duz = os.path.basename(yol).startswith('d')
        for k, kayit in d.get('sorular', {}).items() if isinstance(d.get('sorular'), dict) else []:
            if k in gorulen and (duz == gorulen[k].startswith('d')):
                uyarilar.append(f'{ad} {k}: {gorulen[k]} dosyasında da var; sonraki geçerli sayılır')
            gorulen[k] = os.path.basename(yol)
            if duz and k in qs and isinstance(kayit, dict):
                for m in sizinti(sinav, k, kayit, qs[k]):
                    uyarilar.append(f'{ad} {k}: SIZINTI? {m}')
                for t in kayit.get('terimler', []) if isinstance(kayit.get('terimler'), list) else []:
                    if isinstance(t, dict) and len(t.get('aciklama', '')) > 260:
                        uyarilar.append(f'{ad} {k} "{t.get("metin")}": açıklama {len(t["aciklama"])} karakter; en çok 2 kısa cümle (≤ 260)')
    raporla(hatalar, uyarilar)
    biten = len(set(gorulen) & set(qs))
    print(f'{sinav}: {biten}/{len(qs)} soru · {len(hatalar)} hata · {len(uyarilar)} uyarı')
    if hatalar:
        print('Hataları ilgili parça dosyasında düzelt ve bu komutu yeniden çalıştır.')
        return 1
    birlesik = sozluk(sinav)
    birlesik['sorular'] = {k: birlesik['sorular'][k] for k in sirala(birlesik['sorular'])}
    with open(sozluk_yolu(sinav), 'w', encoding='utf-8') as f:
        json.dump(birlesik, f, ensure_ascii=False, indent=1)
    print(f'Birleştirildi → {sozluk_yolu(sinav)}')
    return 0


def raporla(hatalar, uyarilar):
    for h in hatalar:
        print('HATA  ', h)
    for u in uyarilar[:40]:
        print('uyarı ', u)
    if len(uyarilar) > 40:
        print(f'uyarı  … ve {len(uyarilar) - 40} uyarı daha')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sinav', nargs='?')
    ap.add_argument('--durum', action='store_true')
    ap.add_argument('--sonraki')
    ap.add_argument('--parca')
    ap.add_argument('--duzeltme', action='store_true')
    ap.add_argument('--sizinti', nargs='?', const='')
    ap.add_argument('--adet', type=int, default=10)
    ap.add_argument('--hepsi', action='store_true')
    ap.add_argument('--dosya')
    a = ap.parse_args()
    if a.durum:
        return durum()
    if a.sonraki:
        return sonraki(a.sonraki, a.adet, a.duzeltme)
    if a.parca:
        return print(sonraki_parca(a.parca, a.duzeltme))
    if a.sizinti is not None:
        return sizinti_listesi(a.sizinti)
    if a.dosya:
        d = oku(a.dosya)
        hatalar, uyarilar = denetle_veri(d, sorular(d.get('sinav', '')), os.path.basename(a.dosya))
        raporla(hatalar, uyarilar)
        print(f'{len(hatalar)} hata · {len(uyarilar)} uyarı')
        sys.exit(1 if hatalar else 0)
    if a.hepsi:
        sys.exit(max([denetle_sinav(s) for s in sinavlar()] or [0]))
    if a.sinav:
        sys.exit(denetle_sinav(a.sinav))
    ap.print_help()


if __name__ == '__main__':
    main()
