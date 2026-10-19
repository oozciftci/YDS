// Telifli yerel verileri (local-data/, cikmis_sorular/) tek bir şifreli dosyaya paketler / açar.
//   node scripts/dataVault.mjs lock   [hedefKlasör]   -> <hedef>/vault.enc üretir
//   node scripts/dataVault.mjs unlock [kaynakKlasör]  -> vault.enc'i proje köküne açar
// Şifre: gizli prompt'tan (yapıştırılabilir) ya da YDS_VAULT_PASS ortam değişkeninden alınır; hiçbir yere yazılmaz.
// Biçim: "YDSV1" | salt(16) | iv(12) | AES-256-GCM(gzip(paket)) | tag(16); anahtar = scrypt(N=2^17, r=8, p=1).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['local-data', 'cikmis_sorular']
const MAGIC = Buffer.from('YDSV1')
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 512 * 1024 * 1024 }

function askHidden(question) {
  return new Promise((res, rej) => {
    if (!process.stdin.isTTY) return rej(new Error('Etkileşimli terminal yok; YDS_VAULT_PASS ortam değişkenini kullan.'))
    process.stdout.write(question)
    let buf = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          return res(buf)
        }
        if (ch === '\u0003') process.exit(130)
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1)
        else buf += ch
      }
    }
    process.stdin.on('data', onData)
  })
}

async function getPassword(confirm) {
  if (process.env.YDS_VAULT_PASS) return process.env.YDS_VAULT_PASS
  const p = await askHidden('Şifre: ')
  if (p.length < 12) throw new Error('Şifre en az 12 karakter olmalı.')
  if (confirm && (await askHidden('Şifre (tekrar): ')) !== p) throw new Error('Şifreler uyuşmuyor.')
  return p
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    statSync(p).isDirectory() ? walk(p, out) : out.push(p)
  }
  return out
}

function pack() {
  const index = []
  const chunks = []
  let offset = 0
  for (const d of DIRS) {
    const abs = join(ROOT, d)
    if (!existsSync(abs)) continue
    for (const f of walk(abs)) {
      const data = readFileSync(f)
      index.push({ path: relative(ROOT, f).split(sep).join('/'), size: data.length, offset })
      chunks.push(data)
      offset += data.length
    }
  }
  const head = Buffer.from(JSON.stringify(index))
  const len = Buffer.alloc(4)
  len.writeUInt32BE(head.length)
  return Buffer.concat([len, head, ...chunks])
}

function unpack(buf) {
  const hl = buf.readUInt32BE(0)
  const index = JSON.parse(buf.subarray(4, 4 + hl).toString())
  const base = 4 + hl
  for (const e of index) {
    if (e.path.includes('..') || !DIRS.some((d) => e.path.startsWith(d + '/'))) throw new Error('Geçersiz yol: ' + e.path)
    const target = join(ROOT, e.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, buf.subarray(base + e.offset, base + e.offset + e.size))
  }
  return index.length
}

async function lock(outDir) {
  const pass = await getPassword(true)
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(pass, salt, 32, SCRYPT)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const header = Buffer.concat([MAGIC, salt, iv])
  cipher.setAAD(header)
  const enc = Buffer.concat([cipher.update(gzipSync(pack(), { level: 9 })), cipher.final()])
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, 'vault.enc')
  writeFileSync(file, Buffer.concat([header, enc, cipher.getAuthTag()]))
  console.log(`Şifrelendi: ${file} (${(statSync(file).size / 1048576).toFixed(1)} MB)`)
}

async function unlock(inDir) {
  const file = join(inDir, 'vault.enc')
  if (!existsSync(file)) throw new Error('Bulunamadı: ' + file)
  const raw = readFileSync(file)
  const header = raw.subarray(0, 33)
  if (!header.subarray(0, 5).equals(MAGIC)) throw new Error('Geçersiz vault dosyası.')
  const pass = await getPassword(false)
  const key = scryptSync(pass, header.subarray(5, 21), 32, SCRYPT)
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(21, 33))
  decipher.setAAD(header)
  decipher.setAuthTag(raw.subarray(raw.length - 16))
  let plain
  try {
    plain = gunzipSync(Buffer.concat([decipher.update(raw.subarray(33, raw.length - 16)), decipher.final()]))
  } catch {
    throw new Error('Şifre yanlış ya da dosya bozuk.')
  }
  console.log(`Açıldı: ${unpack(plain)} dosya geri yüklendi.`)
}

const [cmd, dirArg] = process.argv.slice(2)
const dir = resolve(dirArg ?? join(ROOT, '..', 'YDS-data'))
try {
  if (cmd === 'lock') await lock(dir)
  else if (cmd === 'unlock') await unlock(dir)
  else throw new Error('Kullanım: node scripts/dataVault.mjs lock|unlock [klasör]')
} catch (e) {
  console.error('Hata: ' + e.message)
  process.exit(1)
}
