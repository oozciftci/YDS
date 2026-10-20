// olmOCR ham çıktısını (C:\Projeler\OCR\output\raw\olmocr\<onek>_NNNN_s1.md)
// local-data/kaynaklar/<kitap>/sayfa-NNNN.md biçimine kopyalar. Tekrar çalıştırılabilir.
// Kullanım: node scripts/ocrKaynakSayfa.mjs ss12 sinav-stratejileri-12 745
import fs from 'node:fs';
import path from 'node:path';

const [onek = 'ss12', kitap = 'sinav-stratejileri-12', toplamStr = '745'] = process.argv.slice(2);
const toplam = Number(toplamStr);
const RAW = 'C:/Projeler/OCR/output/raw/olmocr';
const OUT = path.join('local-data', 'kaynaklar', kitap);
fs.mkdirSync(OUT, { recursive: true });

const eksik = [], bos = [];
let yazilan = 0;
for (let n = 1; n <= toplam; n++) {
  const no = String(n).padStart(4, '0');
  const src = path.join(RAW, `${onek}_${no}_s1.md`);
  if (!fs.existsSync(src)) { eksik.push(n); continue; }
  const metin = fs.readFileSync(src, 'utf8').trim();
  if (metin.length < 40) bos.push(n);
  fs.writeFileSync(path.join(OUT, `sayfa-${no}.md`), metin + '\n');
  yazilan++;
}
console.log(`yazılan: ${yazilan}/${toplam}`);
console.log(`eksik (${eksik.length}): ${eksik.join(', ')}`);
console.log(`boş/çok kısa (${bos.length}): ${bos.join(', ')}`);
