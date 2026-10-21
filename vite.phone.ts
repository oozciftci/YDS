import { getCertificate } from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'

// Telefondan erişim (`npm run telefon`): geliştirme sunucusu bu bilgisayarda eskisi gibi http://localhost:5173'te
// kalır (ilerleme aynı yerde durur); ek olarak ev ağına https://<bilgisayarın IP'si>:5180 açılır.
// Kendinden imzalı sertifika: telefon ilk açılışta bir kez uyarı gösterir (uygulamanın bazı parçaları yalnızca https'te çalışır).
// Bilgisayar dışından gelen HER istek (sayfa, kod, /local-api) şifre ister; şifre ilk çalıştırmada üretilir ve
// local-data/telefon/erisim.json'da durur (gitignore). Doğru şifreden sonra telefona 400 günlük çerez yazılır.

const DIR = path.resolve(import.meta.dirname, 'local-data/telefon')
const STATE_FILE = path.join(DIR, 'erisim.json')
const COOKIE = 'yds_tel'
const LOGIN_PATH = '/__telefon/giris'
export const PHONE_PORT = Number(process.env.YDS_TELEFON_PORT) || 5180

const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
const viaPhone = new WeakSet<IncomingMessage>()

interface AccessState {
  password: string
  secret: string
}

let state: AccessState | null = null
function loadState(): AccessState {
  if (state) return state
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as AccessState
  } else {
    // Telefonda kolay yazılsın: küçük harf + rakam, karışan karakterler (l, 1, o, 0, i) yok
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
    const password = Array.from(randomBytes(8), (b) => abc[b % abc.length]).join('')
    state = { password, secret: randomBytes(32).toString('hex') }
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  return state
}

const normalize = (s: string) => s.toLowerCase().replace(/[\s-]/g, '')
// Çerez şifreden türetilir: erisim.json'daki şifre değişince eski girişler geçersiz olur
const token = () => createHmac('sha256', loadState().secret).update(normalize(loadState().password)).digest('hex')

function sameText(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function hasCookie(req: IncomingMessage) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`).exec(req.headers.cookie || '')
  return !!m && fs.existsSync(STATE_FILE) && sameText(m[1], token())
}

const isLoopback = (req: IncomingMessage) => LOOPBACK.includes(req.socket.remoteAddress || '')

/** Bu bilgisayardan (localhost) ya da şifreyle giriş yapmış telefondan gelen istek mi? */
export function trusted(req: IncomingMessage) {
  return viaPhone.has(req) ? hasCookie(req) : isLoopback(req) || hasCookie(req)
}

/** Ev ağındaki adresler (sanal bağdaştırıcılar hariç) */
export function lanAddresses() {
  const out: string[] = []
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback/i.test(name)) continue
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address)
  }
  return out
}

// Yanlış şifre sınırı: adres başına 5 deneme, sonra 10 dakika bekleme
const failures = new Map<string, { count: number; until: number }>()

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const safeNext = (s: string | null) => (s && /^\/(?![/\\])/.test(s) ? s : '/')

function loginPage(res: ServerResponse, next: string, error = '') {
  res.statusCode = 401
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>YDS Kelime · Giriş</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#131416;color:#eceff3;font:16px system-ui,sans-serif}
form{width:min(88vw,320px);display:grid;gap:.8rem}h1{margin:0;font-size:1.3rem}p{margin:0;color:#a3a9b3;font-size:.92rem;line-height:1.4}
input,button{font:inherit;padding:.8rem;border-radius:10px;border:1px solid #3a3f47;background:#1d2024;color:inherit}
button{background:#4f7cff;border:0;color:#fff;font-weight:700}.err{color:#ff8080}</style></head><body>
<form method="post" action="${LOGIN_PATH}"><h1>📱 YDS Kelime</h1>
<p>Bilgisayarda <b>Ayarlar › Telefondan aç</b> bölümündeki şifreyi yaz. Bu telefonda bir kez sorulur.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}
<input name="sifre" type="password" placeholder="Şifre" autocomplete="current-password" autocapitalize="none" autofocus required>
<input type="hidden" name="next" value="${esc(next)}"><button>Giriş</button></form></body></html>`)
}

function handleLogin(req: IncomingMessage, res: ServerResponse) {
  const ip = req.socket.remoteAddress || '?'
  let body = ''
  req.on('data', (c: Buffer) => {
    body += c
    if (body.length > 2000) req.destroy()
  })
  req.on('end', () => {
    const form = new URLSearchParams(body)
    const next = safeNext(form.get('next'))
    const f = failures.get(ip) ?? { count: 0, until: 0 }
    if (f.until > Date.now()) return loginPage(res, next, 'Çok fazla yanlış deneme. 10 dakika sonra tekrar dene.')
    if (!sameText(normalize(form.get('sifre') || ''), normalize(loadState().password))) {
      f.count++
      if (f.count >= 5) Object.assign(f, { count: 0, until: Date.now() + 10 * 60_000 })
      failures.set(ip, f)
      return loginPage(res, next, 'Şifre yanlış.')
    }
    failures.delete(ip)
    res.statusCode = 303
    res.setHeader('Set-Cookie', `${COOKIE}=${token()}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`)
    res.setHeader('Location', next)
    res.end()
  })
}

export function phoneAccess(enabled: boolean): Plugin {
  return {
    name: 'phone-access',
    apply: 'serve',
    configureServer(server) {
      // Kapı: diğer tüm ara katmanlardan (Vite'ın kendi dosya sunumu dâhil) önce çalışır
      server.middlewares.use((req, res, next) => {
        if (trusted(req)) return next()
        if (!enabled || !viaPhone.has(req)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        const url = req.url || '/'
        if (req.method === 'POST' && url === LOGIN_PATH) return handleLogin(req, res)
        if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return loginPage(res, safeNext(url))
        res.statusCode = 401
        res.end('Giriş gerekli')
      })

      // Bilgisayardaki Ayarlar kartı için: adres + şifre (yalnızca localhost)
      server.middlewares.use('/local-api/telefon', (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        if (viaPhone.has(req) || !isLoopback(req)) {
          res.statusCode = 403
          res.end('{}')
          return
        }
        res.end(JSON.stringify(enabled ? { active: true, urls: lanAddresses().map((ip) => `https://${ip}:${PHONE_PORT}`), password: loadState().password } : { active: false }))
      })

      if (!enabled || !server.httpServer) return
      const main = server.httpServer
      loadState()
      main.once('listening', async () => {
        const pem = await getCertificate(path.join(DIR, 'sertifika'), 'yds-kelime')
        const phone = https.createServer({ key: pem, cert: pem }, (req, res) => {
          viaPhone.add(req)
          server.middlewares(req, res)
        })
        // HMR (wss) bağlantısı ana sunucunun WebSocket'ine aktarılır
        phone.on('upgrade', (req: IncomingMessage, socket, head) => {
          viaPhone.add(req)
          if (!trusted(req)) return socket.destroy()
          main.emit('upgrade', req, socket, head)
        })
        phone.on('error', (e) => server.config.logger.error(`Telefon sunucusu açılamadı: ${e.message}`))
        phone.listen(PHONE_PORT, '0.0.0.0')
        main.once('close', () => phone.close())
      })
      const print = server.printUrls.bind(server)
      server.printUrls = () => {
        print()
        const urls = lanAddresses().map((ip) => `https://${ip}:${PHONE_PORT}`)
        server.config.logger.info(`  📱 Telefondan: ${urls.join('  ·  ') || '(ev ağı bulunamadı)'}   şifre: ${loadState().password}`)
      }
    },
  }
}
