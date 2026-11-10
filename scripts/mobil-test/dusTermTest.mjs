// DUS terim balonları — başsız Chrome, telefon boyutu, gerçek dokunma olayları.
// Dener: terimlerin altı çizili; kökteki terime dokununca balon açılıp AÇIK kalıyor; şıktaki terim cevaptan önce
// kilitli ve dokunmak şıkkı SEÇMİYOR; "Yine de göster" açıklamayı açıyor; dışarı dokununca kapanıyor; cevaptan sonra
// şık terimi kilitsiz; "Bu soru ne soruyor?" açılıyor; yatay taşma yok.
// Kullanım: MSYS_NO_PATHCONV=1 node scripts/mobil-test/dusTermTest.mjs "<çıktı klasörü>" [taban adres]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, base = 'http://localhost:5173'] = process.argv
const PAGE = '/dus/2012-ilkbahar/kbt'
fs.mkdirSync(outDir, { recursive: true })
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${path.join(outDir, 'prof-terim')}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9342/json/list')).json()
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
async function tap(x, y) {
  await touch('touchStart', [[x, y]])
  await sleep(60)
  await touch('touchEnd', [])
  await sleep(500)
}
const center = async (expr) => JSON.parse(await evaluate(`JSON.stringify((() => { const e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + Math.min(r.width / 2, 30), y: r.top + r.height / 2 } })())`))
const term = (txt) => `[...document.querySelectorAll('[class*=_dusTerm_]')].find((e) => e.textContent === ${JSON.stringify(txt)})`
// "Dışarı" dokunuş: soru başlığının sol kenarı (alttaki gezinme çubuğuna değil)
async function tapOutside() {
  const p = JSON.parse(await evaluate(`JSON.stringify((() => { const r = document.querySelector('[class*=_sectionTitle_]').getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 } })())`))
  await tap(p.x, p.y)
}
const dialog = () => evaluate(`document.querySelector('[role=dialog][aria-label$="açıklama"]')?.innerText ?? null`)
let fail = 0
const check = (name, ok, extra = '') => {
  if (!ok) fail++
  console.log(`${ok ? 'TAMAM' : 'HATA '} ${name}${extra ? ' — ' + extra : ''}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: base + PAGE })
await sleep(2500)
// Temiz başlangıç: bu testin cevap kaydı ve hızlı cevap kapalı
await evaluate(`(async () => { const { resetDusTest } = await import('/src/services/dus.ts'); const { useUserStore } = await import('/src/stores/user.ts'); resetDusTest(useUserStore.getState().activeUserId, '2012-ilkbahar', 'kbt'); localStorage.setItem('yds-focus', '0'); return true })()`)
await send('Page.navigate', { url: base + PAGE })
await sleep(2500)

const terms = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('[class*=_dusTerm_]')].map((e) => e.textContent))`))
check('terimlerin altı çizili', terms.length >= 3, terms.join(', '))
check('yatay taşma yok', (await evaluate('document.documentElement.scrollWidth - innerWidth')) === 0)

// Kökteki terim: açılır ve açık kalır
let c = await center(term('MOD restorasyon'))
await tap(c.x, c.y)
await sleep(400)
let d = await dialog()
check('kök terimi dokununca açılıp açık kalıyor', !!d && d.includes('Üç yüzlü'), JSON.stringify(d?.slice(0, 60)))
await shot('t1-kok.png')

// Dışarı dokununca kapanır
await tapOutside()
check('dışarı dokununca kapanıyor', (await dialog()) === null)

// Şık terimi: kilitli, şıkkı seçmiyor
c = await center(term('Matriks'))
await tap(c.x, c.y)
d = await dialog()
const picked = await evaluate(`[...document.querySelectorAll('[class*=_dusOption_]')].some((li) => /optPicked/.test(li.className))`)
check('şık terimi cevaptan önce kilitli', !!d && d.includes('cevabı ele verebilir'), JSON.stringify(d?.slice(0, 80)))
check('şık terimine dokunmak şıkkı seçmiyor', picked === false)
await shot('t2-kilitli.png')
const show = await center(`[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Yine de'))`)
await tap(show.x, show.y)
d = await dialog()
check('"Yine de göster" açıklamayı açıyor', !!d && d.includes('Dolgu kalıbı'), JSON.stringify(d?.slice(0, 60)))
await tapOutside()

// "Bu soru ne soruyor?"
c = await center(`document.querySelector('[class*=_dusAskBtn_]')`)
await tap(c.x, c.y)
check('"Bu soru ne soruyor?" açılıyor', !!(await evaluate(`document.querySelector('[class*=_dusAskText_]')?.textContent`)))

// Cevapla, sonra şık terimi kilitsiz
c = await center(`document.querySelector('[aria-label="Seçenek A"]')`)
await tap(c.x, c.y)
c = await center(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Cevabı kontrol et'))`)
if (c) await tap(c.x, c.y)
await sleep(500)
c = await center(term('Matriks'))
await tap(c.x, c.y)
d = await dialog()
check('cevaptan sonra şık terimi doğrudan açılıyor', !!d && d.includes('Dolgu kalıbı'), JSON.stringify(d?.slice(0, 60)))
await shot('t3-cevap-sonrasi.png')

// Temizlik
await evaluate(`(async () => { const { resetDusTest } = await import('/src/services/dus.ts'); const { useUserStore } = await import('/src/stores/user.ts'); resetDusTest(useUserStore.getState().activeUserId, '2012-ilkbahar', 'kbt'); return true })()`)
console.log(logs.length ? logs.join('\n') : 'konsol hatası yok')
console.log(fail ? `${fail} HATA` : 'HEPSİ TAMAM')
ws.close()
proc.kill()
process.exit(fail ? 1 : 0)
