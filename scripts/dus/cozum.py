# DUS hazır çözümleri (local-data/dus/cozumler/<sınav>.json) için yardımcı. Yalnızca yerel; API çağırmaz.
# Çözüm biçimi: { "<test>/<no>": { "cozum": "<sade Markdown>", "terimler": [{ "t": "Terim", "a": "Kısa açıklama" }] } }
#
#   python -I scripts/dus/cozum.py --durum
#       sınav başına hazır çözüm sayısı
#   python -I scripts/dus/cozum.py <sınav> <tbt|kbt> --adet N [--kirp]
#       çözümü olmayan sıradaki N soruyu yazar (no, ders, cevap, PDF metni); --kirp: her sorunun görüntüsünü
#       local-data/dus/_kirpik/<sınav>-<test>-<no>.png olarak kaydeder (şekilli soruları görmek için Read ile aç)
#   python -I scripts/dus/cozum.py <sınav> --ekle <dosya.json>
#       dosyadaki { "<test>/<no>": {...} } kayıtlarını ekler (biçim ve cevap harfi denetlenir)
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EXAMS = os.path.join(ROOT, 'local-data', 'dus', 'sinavlar')
SOL = os.path.join(ROOT, 'local-data', 'dus', 'cozumler')
CROP = os.path.join(ROOT, 'local-data', 'dus', '_kirpik')
sys.stdout.reconfigure(encoding='utf-8')

SUBJECTS = {
    'tbt': [('Anatomi', 6), ('Histoloji ve Embriyoloji', 4), ('Fizyoloji', 6), ('Biyokimya', 6), ('Mikrobiyoloji', 6),
            ('Patoloji', 4), ('Farmakoloji', 4), ('Biyoloji ve Genetik', 4)],
    'kbt': [('Restoratif Diş Tedavisi', 10), ('Protetik Diş Tedavisi', 10), ('Ağız, Diş ve Çene Cerrahisi', 10),
            ('Ağız, Diş ve Çene Radyolojisi', 10), ('Periodontoloji', 10), ('Ortodonti', 10), ('Endodonti', 10), ('Pedodonti', 10)],
}


def subject(test, n):
    k = 0
    for name, c in SUBJECTS[test]:
        k += c
        if n <= k:
            return name
    return '?'


def load_exam(sid):
    with open(os.path.join(EXAMS, sid, 'sinav.json'), encoding='utf-8') as f:
        return json.load(f)


def load_sol(sid):
    p = os.path.join(SOL, f'{sid}.json')
    if not os.path.exists(p):
        return {}
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save_sol(sid, data):
    os.makedirs(SOL, exist_ok=True)
    ordered = dict(sorted(data.items(), key=lambda kv: (kv[0].split('/')[0] != 'tbt', int(kv[0].split('/')[1]))))
    with open(os.path.join(SOL, f'{sid}.json'), 'w', encoding='utf-8') as f:
        json.dump(ordered, f, ensure_ascii=False, indent=1)


def solvable(exam):
    for t in exam['tests']:
        for q in t['questions']:
            if q['answer'] != 'X':
                yield t['key'], q


def status():
    total = done = 0
    for sid in sorted(os.listdir(EXAMS)):
        exam = load_exam(sid)
        sol = load_sol(sid)
        qs = list(solvable(exam))
        n = sum(1 for k, q in qs if f"{k}/{q['n']}" in sol)
        total += len(qs)
        done += n
        print(f'{sid:15} {n:4}/{len(qs)}')
    print(f'{"toplam":15} {done:4}/{total}')


def crop(sid, exam, test, q):
    from PIL import Image
    os.makedirs(CROP, exist_ok=True)
    im = Image.open(os.path.join(EXAMS, sid, f"p{q['page']:03d}.webp"))
    W, H = im.size
    x0, y0, x1, y1 = q['box']
    out = os.path.join(CROP, f"{sid}-{test}-{q['n']}.png")
    im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))).save(out)
    return out


def export(sid, test, count, do_crop):
    exam = load_exam(sid)
    sol = load_sol(sid)
    left = [q for k, q in solvable(exam) if k == test and f"{k}/{q['n']}" not in sol]
    print(f'# {exam["title"]} · {test} · çözümü olmayan {len(left)} soru, ilk {min(count, len(left))} tanesi')
    for q in left[:count]:
        text = re.sub(r'^\d+\s*[.)﴿]\s*', '', q['text'])
        print(f"\n## {test}/{q['n']} · {subject(test, q['n'])} · doğru cevap {q['answer']}")
        if do_crop:
            print(f'görüntü: {crop(sid, exam, test, q)}')
        print(text)


def add(sid, path):
    exam = load_exam(sid)
    answers = {f"{k}/{q['n']}": q['answer'] for k, q in solvable(exam)}
    with open(path, encoding='utf-8') as f:
        new = json.load(f)
    sol = load_sol(sid)
    ok = 0
    for key, v in new.items():
        if key not in answers:
            print(f'! {key}: böyle bir soru yok ya da iptal')
            continue
        if not isinstance(v, dict) or not str(v.get('cozum', '')).strip():
            print(f'! {key}: "cozum" boş')
            continue
        m = re.search(r'Doğru cevap:\s*([A-E])', v['cozum'])
        if not m or m.group(1) != answers[key]:
            print(f'! {key}: çözümdeki "Doğru cevap" harfi anahtarla uyuşmuyor (anahtar {answers[key]})')
            continue
        terms = [t for t in v.get('terimler', []) if isinstance(t, dict) and t.get('t') and t.get('a')]
        sol[key] = {'cozum': v['cozum'].strip(), 'terimler': terms}
        ok += 1
    save_sol(sid, sol)
    print(f'{ok}/{len(new)} kayıt eklendi → {sid}: {len(sol)} çözüm')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == '--durum':
        status()
    elif '--ekle' in a:
        add(a[0], a[a.index('--ekle') + 1])
    else:
        export(a[0], a[1], int(a[a.index('--adet') + 1]) if '--adet' in a else 10, '--kirp' in a)
