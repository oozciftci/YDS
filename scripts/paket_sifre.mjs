// Kaynak paketi (telifli içerik) indirme şifresini koyar ya da değiştirir. Şifrenin kendisi saklanmaz: yalnızca scrypt
// özeti local-data/telefon/paket-sifre.json'a yazılır (gitignore). Doğrulama: vite.localBundle.ts.
// Kullanım:
//   node scripts/paket_sifre.mjs                 -> yeni, karmaşık bir şifre üretir ve bir kez ekrana yazar
//   node scripts/paket_sifre.mjs --sifre "…"    -> verilen şifreyi koyar (en az 12 karakter)
import { randomBytes, randomInt, scryptSync } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.resolve(import.meta.dirname, '..', 'local-data', 'telefon', 'paket-sifre.json')

// Telefonda yazılabilir karmaşık şifre: büyük/küçük harf, rakam, sembol; karışan karakterler (I l 1 O 0) yok
const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!?#%+=-']
function generate(len = 20) {
  const all = SETS.join('')
  const chars = SETS.map((s) => s[randomInt(s.length)]) // her kümeden en az bir
  while (chars.length < len) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const i = process.argv.indexOf('--sifre')
const password = i > 0 ? process.argv[i + 1] : generate()
if (!password || password.length < 12) {
  console.error('Şifre en az 12 karakter olmalı.')
  process.exit(1)
}
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 32)
fs.mkdirSync(path.dirname(FILE), { recursive: true })
fs.writeFileSync(FILE, JSON.stringify({ salt: salt.toString('hex'), hash: hash.toString('hex'), at: new Date().toISOString() }, null, 2))
console.log(`Paket şifresi kaydedildi (${path.relative(process.cwd(), FILE)}).`)
if (i < 0) console.log(`Yeni şifre: ${password}\nBu şifre bir daha gösterilmez; güvenli bir yere not et.`)
