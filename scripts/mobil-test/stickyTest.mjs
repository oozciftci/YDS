// Yapışkan notlar (post-it) ve DUS metin görünümü — başsız Chrome, telefon boyutu, gerçek dokunma olayları.
// Dener: notu parmakla taşıma (kalıcı), köşeden boyutlandırma, dokununca açılma (iOS'taki hayalet tıklamayla hemen
// kapanmamalı), açılan notta yazı alanına odaklanma, "Bu sayfa" notunun salt okunur olmaması; DUS sorusunda metin
// görünümü, yatay telefonda odak modunda yatay taşma olmaması.
// Kullanım: MSYS_NO_PATHCONV=1 node scripts/mobil-test/stickyTest.mjs "<çıktı klasörü>"   (sunucu 5176'da)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir] = process.argv
const BASE = 'http://localhost:5176'
const PAGE = '/dus/2012-ilkbahar/tbt'
const prof = path.join(outDir, 'prof-sticky')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9341/json/list')).json()
    if (targets.some((t) => t.type === 'page')) break
  } catch {}
  await sleep(250)
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const logs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 300))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (name) => fs.writeFileSync(path.join(outDir, name), Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'))
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
async function swipe(x0, y0, x1, y1, steps = 8) {
  await touch('touchStart', [[x0, y0]])
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]])
    await sleep(16)
  }
  await touch('touchEnd', [])
  await sleep(500)
}
async function tap(x, y) {
  await touch('touchStart', [[x, y]])
  await sleep(60)
  await touch('touchEnd', [])
}
const rect = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const s = e.style; return { l: parseFloat(s.left), t: parseFloat(s.top), w: parseFloat(s.width), h: parseFloat(s.height) } })()`)
const STICKY = '[aria-label="Yapışkan not (aç)"]'
let fail = 0
const check = (name, ok, extra = '') => {
  if (!ok) fail++
  console.log(`${ok ? 'TAMAM' : 'HATA '} ${name}${extra ? ' — ' + extra : ''}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: BASE + PAGE })
await sleep(2500)
await evaluate(`(async () => {
  const { addSticky } = await import('/src/services/notebook.ts')
  const { useUserStore } = await import('/src/stores/user.ts')
  await addSticky(useUserStore.getState().activeUserId, ${JSON.stringify(PAGE)}, 'Deneme notu', 'sari')
  localStorage.setItem('yds-focus', '0')
  return true
})()`)
await send('Page.navigate', { url: BASE + PAGE })
await sleep(2500)

// 1) DUS metin görünümü
const txt = await evaluate(`JSON.stringify({ metin: !!document.querySelector('[class*=_dusText_]'), sik: document.querySelectorAll('[class*=_dusOptBtn_]').length, tasma: document.documentElement.scrollWidth - innerWidth })`)
const t1 = JSON.parse(txt)
check('DUS sorusu metin olarak', t1.metin && t1.sik === 5, txt)

// 2) Taşıma
const r0 = await rect(STICKY)
await swipe(r0.l + 40, r0.t + 40, r0.l + 140, r0.t + 300)
const r1 = await rect(STICKY)
check('parmakla taşıma', Math.abs(r1.l - r0.l - 100) < 6 && Math.abs(r1.t - r0.t - 260) < 6, JSON.stringify([r0, r1]))

// 3) Boyutlandırma (sağ alt köşe)
await swipe(r1.l + r1.w - 8, r1.t + r1.h - 8, r1.l + r1.w + 40, r1.t + r1.h + 60)
const r2 = await rect(STICKY)
check('köşeden boyutlandırma', r2.w > r1.w + 30 && r2.h > r1.h + 50 && Math.abs(r2.l - r1.l) < 2, JSON.stringify([r1, r2]))

// 4) Kalıcılık
await send('Page.navigate', { url: BASE + PAGE })
await sleep(2500)
const r3 = await rect(STICKY)
check('yenileyince yerinde', r3 && Math.abs(r3.l - r2.l) < 2 && Math.abs(r3.t - r2.t) < 2 && Math.abs(r3.w - r2.w) < 2, JSON.stringify(r3))

// 5) Dokununca açılma; hayalet tıklamayla kapanmamalı
await tap(r3.l + 30, r3.t + 30)
await sleep(700)
const open = await evaluate(`!!document.querySelector('[role=dialog][aria-label="Yapışkan not"]')`)
check('dokununca açılıyor ve açık kalıyor', open)
await shot('s1-acik.png')

// 6) Açık notta yazı alanı (salt okunur değil, dokununca odaklanır)
const ta = JSON.parse(await evaluate(`JSON.stringify((() => { const t = document.querySelector('[role=dialog] textarea'); const r = t.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40, ro: t.readOnly } })())`))
await tap(ta.x, ta.y)
await sleep(300)
check('yapışkan notta yazı alanına odaklanma', !ta.ro && (await evaluate(`document.activeElement?.tagName === 'TEXTAREA'`)))

// 7) Arka plana dokununca küçülür
await tap(20, 830)
await sleep(500)
check('arka plana dokununca küçülüyor', !(await evaluate(`!!document.querySelector('[role=dialog][aria-label="Yapışkan not"]')`)))

// 8) "Bu sayfa" notu salt okunur değil
const pill = JSON.parse(await evaluate(`JSON.stringify((() => { const b = document.querySelector('[title="Bu sayfaya özel not"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })())`))
await tap(pill.x, pill.y)
await sleep(600)
const pt = JSON.parse(await evaluate(`JSON.stringify((() => { const t = document.querySelector('[aria-label="Bu sayfanın notu"] textarea'); const r = t.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40, ro: t.readOnly } })())`))
await tap(pt.x, pt.y)
await sleep(300)
check('"Bu sayfa" notu yazılabilir', !pt.ro && (await evaluate(`document.activeElement?.closest('[aria-label="Bu sayfanın notu"]') != null`)))

// 9) Yatay telefon + odak modu: taşma yok, şıklar ekranda
await evaluate(`localStorage.setItem('yds-focus', '1')`)
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true })
await send('Page.navigate', { url: BASE + PAGE })
await sleep(2500)
const land = JSON.parse(await evaluate(`JSON.stringify({ tasma: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle(document.querySelector('[class*=_dusText_]')).gridTemplateColumns.split(' ').length, sonSik: Math.round(document.querySelectorAll('[class*=_dusOptBtn_]')[4].getBoundingClientRect().bottom), h: innerHeight })`))
check('yatay odakta iki sütun, taşma yok, E şıkkı ekranda', land.tasma === 0 && land.cols === 2 && land.sonSik <= land.h, JSON.stringify(land))
await shot('s2-yatay-odak.png')

// Temizlik: deneme notları
await evaluate(`(async () => { const { db } = await import('/src/db/index.ts'); await db.notebook.filter((n) => n.scope === 'sticky').delete(); return true })()`)
console.log(logs.length ? logs.join('\n') : 'konsol hatası yok')
console.log(fail ? `${fail} HATA` : 'HEPSİ TAMAM')
ws.close()
proc.kill()
process.exit(fail ? 1 : 0)
