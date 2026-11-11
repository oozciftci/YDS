# DUS alt konu etiketi ve spot bilgi kartları için yardımcı ve denetleyici. Görev: docs/antigravity/DUS_KONU_SPOT_GOREVI.md
# Konu listesi: scripts/dus/konular.json (ders kimlikleri src/services/dus.ts DUS_SUBJECTS ile aynı).
# Yazılan parçalar: local-data/dus/konu/parcalar/<sınav>/NNN.json (her parti ~20 soru, ayrı dosya).
# Denetim hatasızsa parçalar local-data/dus/konu/<sınav>.json dosyasında birleştirilir (uygulama onu okur).
# Yalnızca standart kütüphane; local-data/dus/konu dışında hiçbir yere yazmaz. `python -I` ile çalışır.
#
#   python -I scripts/dus/konu_denetle.py --durum                     sınav başına ilerleme
#   python -I scripts/dus/konu_denetle.py --sonraki                   sıradaki parçanın girdisi (ilk bitmemiş sınav)
#   python -I scripts/dus/konu_denetle.py --sonraki 2016 --adet 20    belirli sınav
#   python -I scripts/dus/konu_denetle.py --sonraki --dosyaya         girdiyi local-data/dus/konu/sonraki.txt'ye yazar
#   python -I scripts/dus/konu_denetle.py --parca <dosya>             parçayı denetler; hatasızsa sınavı birleştirir
#   python -I scripts/dus/konu_denetle.py 2016                        o sınavın bütün parçalarını denetler (+ birleştirir)
#   python -I scripts/dus/konu_denetle.py --hepsi                     bütün sınavlar
#   python -I scripts/dus/konu_denetle.py --ozet                      ders → konu soru sayıları; "diger" > %15 uyarısı
#   python -I scripts/dus/konu_denetle.py --dosya docs/antigravity/dus_konu_spot_ornek.json   tek dosyayı denetler
# Sınama için: --konu-dizini <klasör> çıktıları local-data/dus/konu yerine o klasörde arar/yazar.
import argparse
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
KOK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DUS = os.path.join(KOK, 'local-data', 'dus')
OCR = os.path.join(DUS, 'ocr')
COZUM = os.path.join(DUS, 'cozumler')
KONULAR = os.path.join(KOK, 'scripts', 'dus', 'konular.json')
KONU = os.path.join(DUS, 'konu')  # --konu-dizini ile değişebilir

PARCA_BOYU = 20
COZUM_KIRP = 600
KOPYA_KELIME = 8
DIGER_SINIR = 0.15


def oku(yol):
    with open(yol, encoding='utf-8') as f:
        return json.load(f)


# --- Konu sınıflaması -------------------------------------------------------------------------------------------

def konular_yukle():
    d = oku(KONULAR)
    dersler = d['dersler']
    for ders in dersler:
        ids = [k['id'] for k in ders['konular']]
        assert f"{ders['id']}/diger" in ids, f"{ders['id']}: diger konusu yok"
        assert 8 <= len(ids) - 1 <= 14, f"{ders['id']}: {len(ids) - 1} konu (8–14 olmalı)"
        assert len(set(ids)) == len(ids), f"{ders['id']}: yinelenen konu kimliği"
        for k in ids:
            assert re.fullmatch(ders['id'] + r'/[a-z0-9]+(-[a-z0-9]+)*', k), f'geçersiz konu kimliği: {k}'
    return dersler


DERSLER = konular_yukle()
KONU_DERS = {k['id']: ders['id'] for ders in DERSLER for k in ders['konular']}


def ders(anahtar):
    test, no = anahtar.split('/')
    n = int(no)
    for d in DERSLER:
        if d['test'] == test and d['ilk'] <= n <= d['son']:
            return d
    return None


# --- Veri ---------------------------------------------------------------------------------------------------------

def sinavlar():
    return sorted(f[:-5] for f in os.listdir(OCR)
                  if f.endswith('.json') and os.path.exists(os.path.join(DUS, 'sinavlar', f[:-5], 'sinav.json')))


def cozumlu(sinav):
    """Hazır çözüm dosyası var mı? (Yoksa sınav henüz hazırlanıyordur; --sonraki onu kendiliğinden seçmez.)"""
    return os.path.exists(os.path.join(COZUM, sinav + '.json'))


def sirala(anahtarlar):
    return sorted(anahtarlar, key=lambda k: (k.split('/')[0] != 'tbt', int(k.split('/')[1])))


def sorular(sinav):
    """{anahtar: {soru, siklar, sekil}} — OCR metni boş olan sorular atlanır."""
    yol = os.path.join(OCR, sinav + '.json')
    if not os.path.exists(yol):
        return {}
    return {k: v for k, v in oku(yol).items() if v.get('soru', '').strip()}


def cevaplar(sinav):
    sj = oku(os.path.join(DUS, 'sinavlar', sinav, 'sinav.json'))
    return {f"{t['key']}/{q['n']}": q.get('answer') for t in sj['tests'] for q in t['questions']}


def cozumler(sinav):
    yol = os.path.join(COZUM, sinav + '.json')
    return oku(yol) if os.path.exists(yol) else {}


def parca_dizini(sinav):
    return os.path.join(KONU, 'parcalar', sinav)


def parcalar(sinav):
    d = parca_dizini(sinav)
    return sorted(os.path.join(d, f) for f in os.listdir(d) if re.fullmatch(r'\d{3}\.json', f)) if os.path.isdir(d) else []


def birlesik(sinav):
    """Parçaların birleşimi (aynı soru iki parçada varsa sonraki geçerli). Okunamayan parça atlanır."""
    out = {'sinav': sinav, 'surum': 1, 'sorular': {}}
    for yol in parcalar(sinav):
        try:
            s = oku(yol).get('sorular', {})
            if isinstance(s, dict):
                out['sorular'].update(s)
        except Exception:
            pass
    out['sorular'] = {k: out['sorular'][k] for k in sirala(out['sorular']) if re.fullmatch(r'(tbt|kbt)/\d+', k)}
    return out


def sonraki_parca(sinav):
    nolar = [int(os.path.basename(y)[:3]) for y in parcalar(sinav)]
    return os.path.join(parca_dizini(sinav), f'{(max(nolar) if nolar else 0) + 1:03}.json')


def goreli(yol):
    try:
        r = os.path.relpath(yol, KOK)
    except ValueError:
        return yol
    return yol if r.startswith('..') else r.replace('\\', '/')


# --- Denetim kuralları ----------------------------------------------------------------------------------------------

def kucuk(t):
    return t.replace('İ', 'i').replace('I', 'ı').lower()


YASAK = re.compile(
    r'\bbu sorud|\bbu soru\b|\bsoruda\b|\bsorunun\b|\bsoruy[au]\b|yukarıda|aşağıda|\bşıkk|\bşıklar|\bseçenek'
    r'|doğru (cevap|yanıt|şık)|\bcevab|\bcevap\b|şekilde gösteril|şekildeki|resimde|görseldeki|radyografta gösteril'
    r'|verilen (vaka|hasta|şekil|tablo)|\bvakad'
)
HARF_SIK = re.compile(r'(^|\s)[A-E]\)')
CUMLE_SINIRI = re.compile(r'[.!?]\s+[A-ZÇĞİÖŞÜ]')


def kelimeler(t):
    return re.findall(r'[a-zçğıöşüâîû0-9]+', kucuk(t))


def ngramlar(t, n):
    w = kelimeler(t)
    return {tuple(w[i:i + n]) for i in range(len(w) - n + 1)}


def norm(t):
    return ' '.join(kelimeler(t))


def denetle_kayit(k, kayit, q, iptal):
    """Tek soru kaydı. Döndürür: (hatalar, uyarılar)."""
    h, u = [], []
    d = ders(k)
    if not isinstance(kayit, dict):
        return [f'{k}: kayıt bir nesne olmalı'], []
    fazla = set(kayit) - {'konu', 'altBaslik', 'zorluk', 'spotlar'}
    if fazla:
        h.append(f'{k}: bilinmeyen alan(lar): {", ".join(sorted(fazla))}')
    eksik = {'konu', 'altBaslik', 'zorluk', 'spotlar'} - set(kayit)
    if eksik:
        h.append(f'{k}: eksik alan(lar): {", ".join(sorted(eksik))}')
    konu = kayit.get('konu')
    if konu not in KONU_DERS:
        h.append(f'{k}: "konu" = {json.dumps(konu, ensure_ascii=False)} konu listesinde yok ({d["id"]}/… kimliklerinden biri olmalı)')
    elif KONU_DERS[konu] != d['id']:
        h.append(f'{k}: "konu" {konu} başka bir derse ait; bu soru {d["ad"]} dersinde ({d["id"]}/… kimliklerinden biri olmalı)')
    ab = kayit.get('altBaslik')
    if not isinstance(ab, str) or not (3 <= len(ab.strip()) <= 60):
        h.append(f'{k}: "altBaslik" 3–60 karakter olmalı (şu an {len(ab) if isinstance(ab, str) else "yok"})')
    elif YASAK.search(kucuk(ab)):
        h.append(f'{k}: "altBaslik" yasak ifade içeriyor: "{YASAK.search(kucuk(ab)).group(0)}"')
    z = kayit.get('zorluk')
    if isinstance(z, bool) or z not in (1, 2, 3):
        h.append(f'{k}: "zorluk" 1, 2 ya da 3 (tam sayı) olmalı')
    spotlar = kayit.get('spotlar')
    enaz = 0 if iptal else 1
    if not isinstance(spotlar, list) or not (enaz <= len(spotlar) <= 3):
        h.append(f'{k}: "spotlar" {enaz}–3 öğeli bir liste olmalı')
        return h, u
    kok_ng = ngramlar(q['soru'], KOPYA_KELIME)
    gorulen = set()
    for i, s in enumerate(spotlar, 1):
        y = f'{k} spot {i}'
        if not isinstance(s, dict):
            h.append(f'{y}: {{"on": "...", "arka": "..."}} nesnesi olmalı')
            continue
        fazla = set(s) - {'on', 'arka'}
        if fazla:
            h.append(f'{y}: bilinmeyen alan(lar): {", ".join(sorted(fazla))}')
        on, arka = s.get('on'), s.get('arka')
        if not isinstance(on, str) or not (10 <= len(on.strip()) <= 120):
            h.append(f'{y}: "on" 10–120 karakter olmalı (şu an {len(on) if isinstance(on, str) else "yok"})')
        elif not on.strip().endswith('?'):
            h.append(f'{y}: "on" soru biçiminde olmalı ve "?" ile bitmeli')
        if not isinstance(arka, str) or not (15 <= len(arka.strip()) <= 220):
            h.append(f'{y}: "arka" 15–220 karakter olmalı (şu an {len(arka) if isinstance(arka, str) else "yok"})')
        elif arka.strip().endswith('?'):
            h.append(f'{y}: "arka" soru değil, kesin bilgi cümlesi olmalı')
        elif CUMLE_SINIRI.search(arka.strip()):
            u.append(f'{y}: "arka" birden çok cümle gibi görünüyor; tek cümle olmalı')
        for alan, v in (('on', on), ('arka', arka)):
            if not isinstance(v, str):
                continue
            m = YASAK.search(kucuk(v))
            if m:
                h.append(f'{y}: "{alan}" yasak ifade içeriyor: "{m.group(0)}" (spot soruya atıf yapmadan kendi başına anlaşılmalı)')
            if HARF_SIK.search(v):
                h.append(f'{y}: "{alan}" şık harfine atıf yapıyor ("A)" gibi)')
            if kok_ng & ngramlar(v, KOPYA_KELIME):
                h.append(f'{y}: "{alan}" soru kökünden {KOPYA_KELIME}+ kelimelik birebir kopya içeriyor; kendi cümlenle yaz')
            if v != v.strip():
                h.append(f'{y}: "{alan}" başında/sonunda boşluk var')
        for v in (on, arka):
            if isinstance(v, str) and v.strip():
                n = norm(v)
                if n in gorulen:
                    h.append(f'{y}: aynı soruda yinelenen spot metni')
                gorulen.add(n)
    return h, u


def denetle_veri(d, qs, cvp, etiket, sinav=None):
    if not isinstance(d, dict) or not isinstance(d.get('sorular'), dict):
        return [f'{etiket}: en üstte {{"sinav", "surum", "sorular": {{...}}}} olmalı'], []
    hatalar, uyarilar = [], []
    fazla = set(d) - {'sinav', 'surum', 'sorular'}
    if fazla:
        hatalar.append(f'{etiket}: üst düzeyde bilinmeyen alan(lar): {", ".join(sorted(fazla))}')
    if sinav is not None and d.get('sinav') != sinav:
        hatalar.append(f'{etiket}: "sinav" alanı "{sinav}" olmalı')
    if d.get('surum') != 1:
        hatalar.append(f'{etiket}: "surum" 1 olmalı')
    if not d['sorular']:
        hatalar.append(f'{etiket}: "sorular" boş')
    if len(d['sorular']) > PARCA_BOYU + 5:
        uyarilar.append(f'{etiket}: {len(d["sorular"])} soru; parça başına ~{PARCA_BOYU} soru yaz')
    for k, kayit in d['sorular'].items():
        if k not in qs:
            hatalar.append(f'{etiket} {k}: böyle bir soru yok (anahtar "tbt/12" ya da "kbt/7" biçiminde olmalı)')
            continue
        h, u = denetle_kayit(k, kayit, qs[k], cvp.get(k) == 'X')
        hatalar += [f'{etiket} {x}' for x in h]
        uyarilar += [f'{etiket} {x}' for x in u]
    return hatalar, uyarilar


def raporla(hatalar, uyarilar):
    for h in hatalar:
        print('HATA  ', h)
    for u in uyarilar[:40]:
        print('uyarı ', u)
    if len(uyarilar) > 40:
        print(f'uyarı  … ve {len(uyarilar) - 40} uyarı daha')


def sinav_denetimi(sinav):
    """Bütün parçaları denetler. Döndürür: (hatalar, uyarılar, biten anahtarlar)."""
    qs, cvp = sorular(sinav), cevaplar(sinav)
    hatalar, uyarilar, gorulen = [], [], {}
    on_metinleri = {}
    for yol in parcalar(sinav):
        ad = f'{sinav}/{os.path.basename(yol)}'
        try:
            d = oku(yol)
        except Exception as e:
            hatalar.append(f'{ad}: JSON OKUNAMADI — {e}')
            continue
        h, u = denetle_veri(d, qs, cvp, ad, sinav)
        hatalar += h
        uyarilar += u
        for k, kayit in d.get('sorular', {}).items() if isinstance(d.get('sorular'), dict) else []:
            if k in gorulen:
                uyarilar.append(f'{ad} {k}: {gorulen[k]} dosyasında da var; sonraki geçerli sayılır')
            gorulen[k] = os.path.basename(yol)
            for s in kayit.get('spotlar', []) if isinstance(kayit, dict) and isinstance(kayit.get('spotlar'), list) else []:
                if isinstance(s, dict) and isinstance(s.get('on'), str):
                    n = norm(s['on'])
                    if n in on_metinleri and on_metinleri[n] != k:
                        uyarilar.append(f'{ad} {k}: "on" metni {on_metinleri[n]} sorusundaki bir spotla aynı; farklı bir bilgi seç')
                    on_metinleri.setdefault(n, k)
    biten = set(gorulen) & set(qs)
    sira = sirala(qs)
    if biten:
        son = max(sira.index(k) for k in biten)
        atlanan = [k for k in sira[:son] if k not in biten]
        if atlanan:
            uyarilar.append(f'{sinav}: atlanmış soru(lar): {", ".join(atlanan[:15])}{" …" if len(atlanan) > 15 else ""}')
    return hatalar, uyarilar, biten


def denetle_sinav(sinav):
    if not parcalar(sinav):
        print(f'{sinav}: henüz parça yok ({goreli(parca_dizini(sinav))})')
        return 0
    hatalar, uyarilar, biten = sinav_denetimi(sinav)
    qs = sorular(sinav)
    raporla(hatalar, uyarilar)
    print(f'{sinav}: {len(biten)}/{len(qs)} soru · {len(hatalar)} hata · {len(uyarilar)} uyarı')
    if hatalar:
        print('Hataları ilgili parça dosyasında düzelt ve denetimi yeniden çalıştır.')
        return 1
    b = birlesik(sinav)
    b['sorular'] = {k: v for k, v in b['sorular'].items() if k in qs}
    os.makedirs(KONU, exist_ok=True)
    yol = os.path.join(KONU, sinav + '.json')
    with open(yol, 'w', encoding='utf-8') as f:
        json.dump(b, f, ensure_ascii=False, indent=1)
    print(f'Birleştirildi → {goreli(yol)}')
    return 0


def denetle_parca(yol):
    yol = os.path.abspath(yol)
    if not os.path.exists(yol):
        print(f'HATA   dosya yok: {yol}  (yolu --sonraki çıktısından al)')
        return 1
    sinav = os.path.basename(os.path.dirname(yol))
    if os.path.normcase(os.path.dirname(yol)) != os.path.normcase(parca_dizini(sinav)) or sinav not in sinavlar():
        print(f'HATA   parça dosyası {goreli(os.path.join(KONU, "parcalar"))}/<sınav>/NNN.json konumunda olmalı (şu an {goreli(yol)})')
        return 1
    if not re.fullmatch(r'\d{3}\.json', os.path.basename(yol)):
        print('HATA   dosya adı üç haneli numara olmalı: 001.json, 002.json …')
        return 1
    return denetle_sinav(sinav)


# --- Komutlar ----------------------------------------------------------------------------------------------------

def durum():
    tb = tt = 0
    sonraki_s = None
    for s in sinavlar():
        qs = sorular(s)
        biten = len(set(birlesik(s)['sorular']) & set(qs))
        tb += biten
        tt += len(qs)
        if biten < len(qs) and sonraki_s is None:
            sonraki_s = s
        if not cozumlu(s):
            print(f'{s:16} {biten:4}/{len(qs):<4} (hazır çözüm yok; şimdilik atla)')
            continue
        print(f'{s:16} {biten:4}/{len(qs):<4} {"✓" if biten == len(qs) else ""}')
    print(f'TOPLAM {tb}/{tt}' + (f'   sıradaki sınav: {sonraki_s}' if sonraki_s else '   hepsi bitti'))


def girdi(sinav, adet):
    """Sıradaki parçanın girdisi (metin)."""
    qs, cvp, cz = sorular(sinav), cevaplar(sinav), cozumler(sinav)
    biten = set(birlesik(sinav)['sorular'])
    kalan = [k for k in sirala(qs) if k not in biten]
    secilen = kalan[:adet]
    satir = [f'# {sinav}: {len(kalan)} soru kaldı. Bu partide {len(secilen)} soru.']
    if not secilen:
        satir.append('# Bu sınav bitti. --durum ile sıradaki sınavı bul.')
        return '\n'.join(satir)
    satir.append(f'# Çıktıyı YENİ şu dosyaya yaz: {goreli(sonraki_parca(sinav))}')
    satir.append(f'# Sonra: python -I scripts/dus/konu_denetle.py --parca {goreli(sonraki_parca(sinav))}')
    satir.append('')
    dersler = []
    for k in secilen:
        q, d = qs[k], ders(k)
        if d['id'] not in dersler:
            dersler.append(d['id'])
        etiket = []
        if q.get('sekil'):
            etiket.append('ŞEKİLLİ SORU: metin eksik olabilir')
        if cvp.get(k) == 'X':
            etiket.append('İPTAL EDİLMİŞ SORU: spot 0–3')
        satir.append(f'=== {k} · {d["ad"]} (ders: {d["id"]}){"  [" + "; ".join(etiket) + "]" if etiket else ""}')
        satir.append('SORU: ' + q['soru'].replace('\n', ' '))
        for h in 'ABCDE':
            satir.append(f'{h}) {q.get("siklar", {}).get(h, "")}')
        satir.append(f'CEVAP ANAHTARI: {cvp.get(k, "?")}')
        c = re.sub(r'\s+', ' ', cz.get(k, {}).get('cozum', '')).strip()
        if len(c) > COZUM_KIRP:
            c = c[:COZUM_KIRP].rsplit(' ', 1)[0] + ' …'
        satir.append('HAZIR ÇÖZÜM (denetlenmemiş): ' + (c or '(yok)'))
        satir.append('')
    for did in dersler:
        d = next(x for x in DERSLER if x['id'] == did)
        satir.append(f'--- KONU LİSTESİ: {d["ad"]} (yalnızca bu kimlikler)')
        for kn in d['konular']:
            satir.append(f'{kn["id"]} — {kn["ad"]}: {kn["kapsam"]}')
        satir.append('')
    return '\n'.join(satir)


def sonraki(sinav, adet, dosyaya):
    if not sinav:
        sinav = next((s for s in sinavlar() if cozumlu(s) and set(sorular(s)) - set(birlesik(s)['sorular'])), None)
        if not sinav:
            return print('Bütün sınavlar bitti. --hepsi ve --ozet çalıştır.')
    if sinav not in sinavlar():
        print(f'HATA   böyle bir sınav yok: {sinav}. Sınavlar: {", ".join(sinavlar())}')
        return 1
    if not cozumlu(sinav):
        print(f'HATA   {sinav} için hazır çözüm dosyası yok (sınav henüz hazırlanıyor); başka bir sınavla çalış.')
        return 1
    hatalar, _, _ = sinav_denetimi(sinav)
    if hatalar:
        raporla(hatalar, [])
        print(f'Önce {sinav} parçalarındaki {len(hatalar)} hatayı düzelt; sonra --sonraki.')
        return 1
    metin = girdi(sinav, adet)
    if dosyaya:
        os.makedirs(KONU, exist_ok=True)
        yol = os.path.join(KONU, 'sonraki.txt')
        with open(yol, 'w', encoding='utf-8') as f:
            f.write(metin + '\n')
        print(metin.split('\n')[0])
        print(metin.split('\n')[1])
        print(f'Girdi yazıldı → {goreli(yol)}')
    else:
        print(metin)
    return 0


def ozet():
    sayac = {}
    zorluk = {}
    for s in sinavlar():
        qs = sorular(s)
        for k, kayit in birlesik(s)['sorular'].items():
            if k not in qs or not isinstance(kayit, dict):
                continue
            sayac[kayit.get('konu')] = sayac.get(kayit.get('konu'), 0) + 1
            did = ders(k)['id']
            zorluk.setdefault(did, []).append(kayit.get('zorluk'))
    uyar = []
    for d in DERSLER:
        top = sum(sayac.get(kn['id'], 0) for kn in d['konular'])
        if not top:
            print(f'\n## {d["ad"]}: henüz kayıt yok')
            continue
        z = [x for x in zorluk.get(d['id'], []) if x in (1, 2, 3)]
        print(f'\n## {d["ad"]} ({top} soru; ort. zorluk {sum(z) / len(z):.2f})')
        for kn in d['konular']:
            n = sayac.get(kn['id'], 0)
            print(f'  {n:4}  {n / top:6.1%}  {kn["id"]}')
        dg = sayac.get(f'{d["id"]}/diger', 0) / top
        if dg > DIGER_SINIR:
            uyar.append(f'{d["ad"]}: "diger" oranı {dg:.0%} (> %{DIGER_SINIR * 100:.0f}) — konu listesi bu dersi iyi kapsamıyor olabilir')
    gecersiz = {k: v for k, v in sayac.items() if k not in KONU_DERS}
    if gecersiz:
        uyar.append(f'listede olmayan konu kimlikleri: {gecersiz}')
    print()
    for x in uyar:
        print('UYARI ', x)
    print(f'{sum(sayac.values())} soru · {len(uyar)} uyarı')


def main():
    global KONU
    ap = argparse.ArgumentParser(description='DUS alt konu + spot bilgi denetleyicisi')
    ap.add_argument('sinav', nargs='?')
    ap.add_argument('--durum', action='store_true')
    ap.add_argument('--sonraki', nargs='?', const='')
    ap.add_argument('--adet', type=int, default=PARCA_BOYU)
    ap.add_argument('--dosyaya', action='store_true')
    ap.add_argument('--parca')
    ap.add_argument('--hepsi', action='store_true')
    ap.add_argument('--ozet', action='store_true')
    ap.add_argument('--dosya')
    ap.add_argument('--konu-dizini')
    a = ap.parse_args()
    if a.konu_dizini:
        KONU = os.path.abspath(a.konu_dizini)
    if a.durum:
        return durum()
    if a.sonraki is not None:
        sys.exit(sonraki(a.sonraki, a.adet, a.dosyaya) or 0)
    if a.parca:
        sys.exit(denetle_parca(a.parca))
    if a.ozet:
        return ozet()
    if a.dosya:
        d = oku(a.dosya)
        s = d.get('sinav', '') if isinstance(d, dict) else ''
        if s not in sinavlar():
            print(f'HATA   "sinav" alanı geçerli bir sınav değil: {s!r}')
            sys.exit(1)
        hatalar, uyarilar = denetle_veri(d, sorular(s), cevaplar(s), os.path.basename(a.dosya), s)
        raporla(hatalar, uyarilar)
        print(f'{len(hatalar)} hata · {len(uyarilar)} uyarı')
        sys.exit(1 if hatalar else 0)
    if a.hepsi:
        sys.exit(max([denetle_sinav(s) for s in sinavlar()] or [0]))
    if a.sinav:
        if a.sinav not in sinavlar():
            print(f'HATA   böyle bir sınav yok: {a.sinav}')
            sys.exit(1)
        sys.exit(denetle_sinav(a.sinav))
    ap.print_help()


if __name__ == '__main__':
    main()
