# DUS soru kutularını C:\Projeler\OCR projesindeki görme-dil modeliyle (varsayılan Qwen3-VL) metne çevirir
# ve her sonucu PDF'in kendi metin katmanıyla (sinav.json → text) kelime kelime karşılaştırır.
# Çıktı: local-data/dus/ocr/<sınav>.json  (yerel, telifli; git'e ve yayına girmez)
#   { "tbt/1": { "soru": "...", "siklar": {"A": "...", ...}, "sekil": false, "uyum": 0.99,
#                "durum": "ok" | "incele" | "duzeltildi", "eksik": [...], "fazla": [...] } }
#   eksik: metin katmanında olup OCR'da olmayan kelimeler; fazla: OCR'da olup metin katmanında olmayanlar.
#
# Kullanım (OCR projesinin Python'u ile — llama_server ve requests orada):
#   C:\Projeler\OCR\.venv\Scripts\python.exe scripts/dus/dus_ocr.py [--sinav 2016] [--limit N] [--force]
#   ... dus_ocr.py --durum                        özet (sınav başına ok / incele / düzeltildi)
#   ... dus_ocr.py --incele [--sinav X] [--adet N]  incelenecekleri listeler (fark kelimeleriyle)
#   ... dus_ocr.py --kirp <sınav> <test/no>       soru kutusunu PNG olarak kaydeder (yolu yazar)
#   ... dus_ocr.py --duzelt duzeltme.json         {"<sınav>": {"tbt/1": {"soru":..., "siklar":{...}, "sekil":bool}}}
#                                                 kaydı değiştirir, uyumu yeniden hesaplar, durum = duzeltildi
#   ... dus_ocr.py --onayla <sınav> <test/no> ... fark zararsızsa (ör. tire/biçim) kaydı olduğu gibi onaylar
import argparse
import base64
import io
import json
import os
import re
import sys
import tempfile
import time
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SINAV = os.path.join(ROOT, 'local-data', 'dus', 'sinavlar')
OUT = os.path.join(ROOT, 'local-data', 'dus', 'ocr')
OCR_PROJE = r'C:\Projeler\OCR'
PORT = 8098  # OCR web arayüzünün kullandığı 8099 ile çakışmasın
ESIK = 1.0  # metin katmanıyla kelime kelime birebir; tek kelime farkı bile incelemeye düşer

sys.stdout.reconfigure(encoding='utf-8')

PROMPT = (
    "Bu görüntü bir Türkçe çoktan seçmeli sınav sorusudur (Diş Hekimliği Uzmanlık Sınavı). "
    "Sorunun metnini EKSİKSİZ ve harfi harfine çıkar, yalnızca şu JSON nesnesini yaz:\n"
    '{"soru": "...", "siklar": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."}, "sekil": false}\n'
    "Kurallar:\n"
    "- \"soru\": soru numarası OLMADAN soru kökü. I., II., III. gibi maddeler, liste satırları ve tablo satırları "
    "ayrı satırda olsun (\\n). Tablo varsa her satırı ' | ' ile ayır.\n"
    "- Satır sonunda tireyle bölünmüş kelimeleri birleştir (\"tedavi- sinde\" → \"tedavisinde\").\n"
    "- \"siklar\": yalnızca şık metni, başında harf ve parantez olmadan. Her şıkkı kendi satırından oku; şıkları birbirinden kopyalama.\n"
    "- Şıklar sütunlu bir tabloysa (şıkların üstünde sütun başlıkları vardır, ör. 'Ana bağlayıcı   Gerekçe'): başlıkları "
    "\"soru\"nun SON satırına ' | ' ile ayırarak yaz, her şıkta da sütunları ' | ' ile ayır "
    "(ör. \"Lingual bar | En basit ana bağlayıcı olması\").\n"
    "- Kimyasal formüllerde alt/üst simgeleri koru (CO₂, HCO₃⁻, H⁺), tepkime oku için → kullan.\n"
    "- \"sekil\": soruda bir şekil, fotoğraf, grafik ya da çizim varsa true. Şeklin içindeki etiketleri yazma.\n"
    "- Türkçe karakterleri (ç ğ ı İ ö ş ü) ve Latince terimleri olduğu gibi koru; düzeltme, özet, yorum yapma.\n"
    "- JSON dışında hiçbir şey yazma."
)


BASLIK_PROMPT = (
    "Bu sorunun şıkları {n} sütunlu bir tablo; şıkların üstünde her sütunun bir başlığı var. "
    "Yalnızca bu {n} sütun başlığını soldan sağa, aralarına ' | ' koyarak TEK satırda yaz. Başka hiçbir şey yazma."
)


# --------------------------------------------------------------------------- yardımcılar

def yukle_sinav(sid):
    with open(os.path.join(SINAV, sid, 'sinav.json'), encoding='utf-8') as f:
        return json.load(f)


def sinavlar():
    return sorted(d for d in os.listdir(SINAV) if os.path.isfile(os.path.join(SINAV, d, 'sinav.json')))


def ocr_yolu(sid):
    return os.path.join(OUT, f'{sid}.json')


def yukle_ocr(sid):
    p = ocr_yolu(sid)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return {}


def kaydet_ocr(sid, data):
    os.makedirs(OUT, exist_ok=True)
    tmp = ocr_yolu(sid) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(data.items(), key=lambda kv: (kv[0][:3], int(kv[0][4:])))), f, ensure_ascii=False, indent=1)
    os.replace(tmp, ocr_yolu(sid))


def sorular(s):
    for t in s['tests']:
        for q in t['questions']:
            yield f"{t['key']}/{q['n']}", q


def kirp(sid, q, buyut=1.5):
    from PIL import Image
    img = Image.open(os.path.join(SINAV, sid, f"p{q['page']:03d}.webp")).convert('RGB')
    W, H = img.size
    x0, y0, x1, y1 = q['box']
    c = img.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    if buyut != 1:
        c = c.resize((int(c.width * buyut), int(c.height * buyut)), Image.LANCZOS)
    return c


def tr_lower(s):
    return s.replace('I', 'ı').replace('İ', 'i').lower()


def kelimeler(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('\ufd3f', ')').replace('\ufd3e', '(')
    s = re.sub(r'(\w)[-‐­]\s+(\w)', r'\1\2', s)  # satır sonu tiresi
    s = tr_lower(s)
    s = s.replace('’', "'").replace('‘', "'")
    w = re.findall(r"[0-9a-zçğıöşüâîûéè]+", s)
    return w


FILIGRAN = {'ösym'[i:j] for i in range(4) for j in range(i + 1, 5)}


def uclari_temizle(toks, n, anah=lambda w: w):
    """Katmanın başında/sonunda kalan filigran parçalarını (ÖSYM → "y", "ösy", "sym") ve soru numarasını atar."""
    atilir = lambda w: anah(w) in FILIGRAN or anah(w) == str(n) or not anah(w)
    while toks and atilir(toks[0]):
        toks = toks[1:]
    while toks and atilir(toks[-1]):
        toks = toks[:-1]
    return toks


def filigran_at(s, n):
    """OCR alanının sonuna karışan büyük harfli filigran parçasını (ÖSYM → "SY", "M") ve ondan önceki soru numarasını atar."""
    toks = s.rstrip().split(' ')
    atildi = False
    while toks and toks[-1].strip('.') in {f.upper() for f in FILIGRAN} | {'ÖSYM'}:
        toks.pop()
        atildi = True
    if atildi and toks and toks[-1].strip('.') == str(n):
        toks.pop()
    return ' '.join(toks) if atildi else s


def katman_kelimeleri(q):
    t = q.get('text', '')
    t = re.sub(r'\b[A-E]\s*[)﴿]', ' ', t)          # şık harfleri
    t = re.sub(r'\s\d{1,3}\s*[.﴿)]?\s*$', ' ', t)    # sondaki soru numarası
    t = re.sub(r'^\s*\d{1,3}\s*[.﴿)]\s*', ' ', t)    # baştaki soru numarası
    return uclari_temizle(kelimeler(t), q.get('n'))


def ocr_metni(k):
    return k.get('soru', '') + ' ' + ' '.join(k.get('siklar', {}).get(h, '') for h in 'ABCDE')


def karsilastir(q, k):
    from collections import Counter
    a = Counter(katman_kelimeleri(q))
    b = Counter(kelimeler(ocr_metni(k)))
    eksik = list((a - b).elements())
    fazla = list((b - a).elements())
    na, nb = sum(a.values()), sum(b.values())
    if not na:
        return 1.0, eksik, fazla
    rec = 1 - len(eksik) / na
    prec = 1 - len(fazla) / nb if nb else 0
    return round(min(rec, prec), 4), eksik, fazla


def katman_ham(q):
    """Metin katmanının ham kelimeleri (şık harfleri ve soru numarası atılmış, satır sonu tireleri birleşmiş)."""
    t = unicodedata.normalize('NFC', q.get('text', '')).replace('﴿', ')').replace('﴾', '(')
    t = re.sub(r'(?<!\S)[A-E]\s*\)', ' ', t)
    t = re.sub(r'\s\d{1,3}\s*[.)]?\s*$', ' ', t)
    t = re.sub(r'^\s*\d{1,3}\s*[.)]\s*', ' ', t)
    t = re.sub(r'(\w)[-‐­]\s+(\w)', r'\1\2', t)
    return uclari_temizle(t.split(), q.get('n'), anahtar)


def anahtar(tok):
    return ''.join(kelimeler(tok))


def oto_duzelt(q, k):
    """OCR kelimelerini metin katmanıyla hizalar; küçük okuma hatalarını, bölünmüş/birleşmiş kelimeleri katmandaki
    doğru yazımla değiştirir. Eksik/fazla kelimelere dokunmaz (onlar incelemeye kalır). Değişen kelime sayısını döndürür."""
    import difflib
    katman = [w for w in katman_ham(q) if anahtar(w)]
    lk = [anahtar(w) for w in katman]
    alanlar = [('soru', None)] + [('siklar', h) for h in 'ABCDE']
    parcalar = []  # her alan için [token, ayraç, token, ayraç ...]
    ref = []       # (alan_index, parça_index, anahtar)
    for ai, (a, h) in enumerate(alanlar):
        metin = k.get('soru', '') if h is None else k.get('siklar', {}).get(h, '')
        p = re.split(r'(\s+)', metin)
        parcalar.append(p)
        for pi in range(0, len(p), 2):
            key = anahtar(p[pi])
            if key:
                ref.append((ai, pi, key))
    ok_ = [r[2] for r in ref]
    sm = difflib.SequenceMatcher(None, ok_, lk, autojunk=False)
    n = 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':  # harfler aynı, noktalama/kesme işareti farklı olabilir ("kaslarından'dır")
            for i, j in zip(range(i1, i2), range(j1, j2)):
                ai, pi, _ = ref[i]
                if parcalar[ai][pi].replace('’', "'") != katman[j].replace('’', "'"):
                    parcalar[ai][pi] = katman[j]
                    n += 1
            continue
        if op != 'replace':
            continue
        o_s, l_s = ''.join(ok_[i1:i2]), ''.join(lk[j1:j2])
        if not (o_s == l_s or (max(i2 - i1, j2 - j1) <= 3 and difflib.SequenceMatcher(None, o_s, l_s).ratio() >= 0.75)):
            continue
        if len({ref[i][0] for i in range(i1, i2)}) != 1:
            continue
        ai = ref[i1][0]
        p = parcalar[ai]
        ilk = ref[i1][1]
        son = ref[i2 - 1][1]
        if any(p[x] and x % 2 == 1 and '\n' in p[x] for x in range(ilk, son)):
            continue  # satır kırılımını bozma
        p[ilk] = ' '.join(katman[j1:j2])
        for x in range(ilk + 1, son + 1):
            p[x] = ''
        n += j2 - j1
    if n:
        for ai, (a, h) in enumerate(alanlar):
            metin = re.sub(r' {2,}', ' ', ''.join(parcalar[ai])).strip()
            if h is None:
                k['soru'] = metin
            else:
                k.setdefault('siklar', {})[h] = metin
    return n


def degerlendir(q, k):
    if k.get('durum') not in ('duzeltildi', 'onaylandi') and k.get('soru'):
        k['soru'] = filigran_at(satirlari_duzenle(k['soru']), q.get('n'))
        k['siklar'] = {h: filigran_at(v, q.get('n')) for h, v in k.get('siklar', {}).items()}
        n = oto_duzelt(q, k)
        if n:
            k['oto'] = k.get('oto', 0) + n
    if k.get('soru'):
        k['soru'] = madde_ayir(k['soru'])
    uyum, eksik, fazla = karsilastir(q, k)
    k['uyum'], k['eksik'], k['fazla'] = uyum, eksik[:30], fazla[:30]
    tam = all(k.get('siklar', {}).get(h, '').strip() for h in 'ABCDE')
    if k.get('durum') not in ('duzeltildi', 'onaylandi'):
        k['durum'] = 'ok' if (uyum >= ESIK and tam) else 'incele'
    return k


MADDE = re.compile(r'^\s*((I{1,3}|IV|VI{0,3}|IX|X)\.|[-•▪]|\d{1,2}[.)]|[a-e]\)|[A-Z]\s*[:.)-])')


def madde_ayir(s):
    """Tek satıra yazılmış "I. ... II. ... III. ..." maddelerini ayrı satırlara böler; son maddeden sonra gelen soru
    cümlesini ("... hangileri doğrudur?") da ayrı satıra alır. Kelimelere dokunmaz."""
    out = []
    for satir in s.split('\n'):
        if re.match(r'I\.\s', satir) and re.search(r'\s(II|III|IV|V|VI)\.\s', satir):
            parcalar = re.split(r'\s(?=(?:II|III|IV|V|VI)\.\s)', satir)
            son = parcalar[-1]
            m = list(re.finditer(r'[.!]\s+(?=[A-ZÇĞİÖŞÜ])', son))
            for b in reversed(m):
                kuyruk = son[b.end():]
                if 'hangi' in kuyruk and not re.search(r'[.!]\s+[A-ZÇĞİÖŞÜ]', kuyruk):
                    parcalar[-1:] = [son[: b.start() + 1], kuyruk]
                    break
            out.extend(parcalar)
        else:
            out.append(satir)
    return '\n'.join(out)


def satirlari_duzenle(s):
    """Modelin görsel satır kırılımlarını kaldırır; madde (I., II.), liste ve tablo satırlarını korur."""
    satirlar = [x.strip() for x in s.split('\n') if x.strip()]
    if not satirlar:
        return ''
    out = [satirlar[0]]
    for x in satirlar[1:]:
        onceki = out[-1]
        koru = (MADDE.match(x) or MADDE.match(onceki) or '|' in x or '|' in onceki) and not x[:1].islower()
        if koru:
            out.append(x)
        else:
            out[-1] = onceki + ' ' + x
    return '\n'.join(out)


def json_ayikla(metin):
    m = re.search(r'\{.*\}', metin, re.S)
    if not m:
        raise ValueError('JSON yok')
    d = json.loads(m.group(0))
    siklar = d.get('siklar') or {}
    siklar = {h: re.sub(r'^\s*[A-E]\s*[)\].:]\s*', '', str(siklar.get(h, '')).strip()) for h in 'ABCDE'}
    soru = satirlari_duzenle(re.sub(r'^\s*\d{1,3}\s*[.)]\s*', '', str(d.get('soru', '')).strip()))
    return {'soru': soru, 'siklar': siklar, 'sekil': bool(d.get('sekil'))}


# --------------------------------------------------------------------------- OCR

def calistir(args):
    sys.path.insert(0, os.path.join(OCR_PROJE, 'scripts'))
    import requests
    import llama_server  # OCR projesi: modeli yükler, çıkışta kapatır
    import config as ocr_config

    spec = ocr_config.MODELS[args.model]
    hedef = [args.sinav] if args.sinav else sinavlar()
    isler = []
    for sid in hedef:
        s = yukle_sinav(sid)
        mevcut = yukle_ocr(sid)
        for key, q in sorular(s):
            if q.get('answer') == 'X' and not args.iptal:
                continue
            if key in mevcut and not args.force and not (args.yeniden_incele and mevcut[key].get('durum') == 'incele'):
                continue
            isler.append((sid, key, q))
    if args.limit:
        isler = isler[:args.limit]
    print(f'{len(isler)} soru okunacak ({args.model}).', flush=True)
    if not isler:
        return

    t0 = time.time()
    with llama_server.running(args.model, port=PORT) as url:
        acik = {}
        for i, (sid, key, q) in enumerate(isler, 1):
            if sid not in acik:
                acik = {sid: yukle_ocr(sid)}
            buf = io.BytesIO()
            kirp(sid, q).save(buf, format='PNG', optimize=True)
            uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
            payload = {
                'messages': [{'role': 'user', 'content': [
                    {'type': 'image_url', 'image_url': {'url': uri}},
                    {'type': 'text', 'text': PROMPT}]}],
                'temperature': 0.0, 'max_tokens': 1500, 'stream': False,
            }
            k = None
            for deneme in range(2):
                try:
                    r = requests.post(f'{url}/v1/chat/completions', json=payload, timeout=300)
                    r.raise_for_status()
                    k = json_ayikla(r.json()['choices'][0]['message']['content'] or '')
                    break
                except Exception as e:  # noqa: BLE001
                    err = str(e)
            if k is None:
                k = {'soru': '', 'siklar': {}, 'sekil': False, 'hata': err[:200]}
            # Tablolu şıklarda model sütun başlıklarını çoğu zaman atlıyor: yalnızca başlıkları ayrıca sor
            sutun = max((v.count(' | ') for v in k.get('siklar', {}).values()), default=0)
            son = (k.get('soru') or '').split('\n')[-1]
            if sutun and ' | ' not in son:
                try:
                    p2 = {**payload, 'max_tokens': 120, 'messages': [{'role': 'user', 'content': [
                        payload['messages'][0]['content'][0],
                        {'type': 'text', 'text': BASLIK_PROMPT.format(n=sutun + 1)}]}]}
                    r = requests.post(f'{url}/v1/chat/completions', json=p2, timeout=120)
                    b = (r.json()['choices'][0]['message']['content'] or '').strip().strip('"').splitlines()[0].strip()
                    if b.count(' | ') == sutun:
                        k['soru'] = (k['soru'].rstrip() + '\n' + b).strip()
                except Exception:  # noqa: BLE001
                    pass
            k['model'] = args.model
            degerlendir(q, k)
            acik[sid][key] = k
            kaydet_ocr(sid, acik[sid])
            gecen = time.time() - t0
            print(f'[{i}/{len(isler)}] {sid} {key} uyum={k["uyum"]:.3f} {k["durum"]}'
                  f'{" ŞEKİL" if k.get("sekil") else ""}  ({gecen / i:.1f} sn/soru)', flush=True)


# --------------------------------------------------------------------------- denetim araçları

def durum():
    top = {'ok': 0, 'incele': 0, 'duzeltildi': 0, 'onaylandi': 0}
    for sid in sinavlar():
        s = yukle_sinav(sid)
        n = sum(1 for _, q in sorular(s) if q.get('answer') != 'X')
        o = yukle_ocr(sid)
        c = {d: sum(1 for k in o.values() if k.get('durum') == d) for d in top}
        for d in top:
            top[d] += c[d]
        sekil = sum(1 for k in o.values() if k.get('sekil'))
        print(f'{sid:15} {len(o):4}/{n:<4} ok {c["ok"]:4}  incele {c["incele"]:3}  düzeltildi {c["duzeltildi"]:3}  onaylandı {c["onaylandi"]:3}  şekil {sekil}')
    print('TOPLAM', top)


def incele(args):
    hedef = [args.sinav] if args.sinav else sinavlar()
    n = 0
    for sid in hedef:
        for key, k in yukle_ocr(sid).items():
            if k.get('durum') != 'incele':
                continue
            print(f'{sid} {key} uyum={k.get("uyum")} sekil={k.get("sekil")}  eksik={" ".join(k.get("eksik", [])[:12])}  |  fazla={" ".join(k.get("fazla", [])[:12])}{"  HATA " + k["hata"] if k.get("hata") else ""}')
            n += 1
            if args.adet and n >= args.adet:
                return


def kirp_kaydet(sid, key):
    s = yukle_sinav(sid)
    q = dict(sorular(s))[key]
    p = os.path.join(tempfile.gettempdir(), f'dus_{sid}_{key.replace("/", "_")}.png')
    kirp(sid, q, buyut=1.0).save(p)
    k = yukle_ocr(sid).get(key, {})
    print(p)
    print('METİN KATMANI:', q.get('text', ''))
    print('OCR:', json.dumps({x: k.get(x) for x in ('soru', 'siklar', 'sekil')}, ensure_ascii=False))


def duzelt(yol):
    with open(yol, encoding='utf-8') as f:
        d = json.load(f)
    for sid, kayitlar in d.items():
        s = yukle_sinav(sid)
        qs = dict(sorular(s))
        o = yukle_ocr(sid)
        for key, yeni in kayitlar.items():
            k = dict(o.get(key, {}))
            for x in ('soru', 'sekil'):
                if x in yeni:
                    k[x] = yeni[x]
            if 'siklar' in yeni:  # yalnızca verilen harfler değişir
                k['siklar'] = {**k.get('siklar', {}), **yeni['siklar']}
            k['durum'] = 'duzeltildi'
            k.pop('hata', None)
            degerlendir(qs[key], k)
            o[key] = k
            print(f'{sid} {key} → uyum {k["uyum"]}  eksik={" ".join(k["eksik"][:8])} fazla={" ".join(k["fazla"][:8])}')
        kaydet_ocr(sid, o)


def onayla(sid, keys):
    o = yukle_ocr(sid)
    for key in keys:
        if key in o:
            o[key]['durum'] = 'onaylandi'
            print(sid, key, 'onaylandı')
    kaydet_ocr(sid, o)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sinav')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--iptal', action='store_true', help='iptal edilen soruları da oku')
    ap.add_argument('--model', default='qwen3vl')
    ap.add_argument('--durum', action='store_true')
    ap.add_argument('--incele', action='store_true')
    ap.add_argument('--adet', type=int)
    ap.add_argument('--kirp', nargs=2, metavar=('SINAV', 'TEST/NO'))
    ap.add_argument('--duzelt', metavar='JSON')
    ap.add_argument('--onayla', nargs='+', metavar='SINAV TEST/NO')
    ap.add_argument('--yeniden-incele', action='store_true', help='yalnızca "incele" durumundakileri yeniden okut')
    ap.add_argument('--yeniden-degerlendir', action='store_true', help='OCR çalıştırmadan uyumları yeniden hesaplar')
    a = ap.parse_args()
    if a.durum:
        durum()
    elif a.incele:
        incele(a)
    elif a.kirp:
        kirp_kaydet(*a.kirp)
    elif a.duzelt:
        duzelt(a.duzelt)
    elif a.onayla:
        onayla(a.onayla[0], a.onayla[1:])
    elif a.yeniden_degerlendir:
        for sid in ([a.sinav] if a.sinav else sinavlar()):
            qs = dict(sorular(yukle_sinav(sid)))
            o = yukle_ocr(sid)
            for key, k in o.items():
                degerlendir(qs[key], k)
            kaydet_ocr(sid, o)
        durum()
    else:
        calistir(a)


if __name__ == '__main__':
    main()
