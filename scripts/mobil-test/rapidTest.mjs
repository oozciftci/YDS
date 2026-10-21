// Hızlı ileri-geri: donma var mı? Kitap (dokunma/kaydırma), sınav ve kelime kartı (kaydırma) — başsız Chrome, telefon.
import { spawn } from 'node:child_process'
import path from 'node:path'

const [, , outDir] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-rapid')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9340', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9340/json/list')).json()
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
async function tap(x, y) {
  await touch('touchStart', [[x, y]])
  await touch('touchEnd', [])
}
async function swipe(dir, y, gap = 0) {
  const x0 = dir === 1 ? 330 : 60
  await touch('touchStart', [[x0, y]])
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [[x0 - dir * i * 30, y]])
    await sleep(8)
  }
  await touch('touchEnd', [])
  if (gap) await sleep(gap)
}
const leftovers = () => evaluate(`document.querySelectorAll('div[data-focus-keep][aria-hidden]').length`)

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1500)
await evaluate(`(async () => {
  const { bulkCreateWords } = await import('/src/services/words.ts')
  await bulkCreateWords('user_ozgur', ['because of', 'benefit', 'consider', 'decline', 'emerge', 'foster', 'grasp', 'hinder'].map((t) => ({ term: t, definition: 'anlam ' + t, partOfSpeech: 'verb' })))
  localStorage.setItem('yds-book-mode', 'full'); localStorage.setItem('yds-focus', '1')
  return true
})()`)

// 1) Kitap: hızlı dokunma (sağ/sol), sonra hızlı kaydırma
await send('Page.navigate', { url: BASE + '/kitap/essential-grammar-in-use/s/20' })
await sleep(2500)
const page = () => evaluate(`location.pathname.split('/').pop() + (location.search || '')`)
console.log('kitap başlangıç:', await page())
for (let i = 0; i < 10; i++) { await tap(360, 400); await sleep(60) }
await sleep(1200)
console.log('  10 hızlı ileri dokunuş →', await page())
for (let i = 0; i < 10; i++) { await tap(30, 400); await sleep(60) }
await sleep(1200)
console.log('  10 hızlı geri dokunuş →', await page())
for (let i = 0; i < 8; i++) await swipe(i % 2 ? -1 : 1, 400, 40)
await sleep(1500)
console.log('  8 hızlı ileri-geri kaydırma →', await page())
await tap(360, 400); await sleep(1200)
console.log('  sonra tek dokunuş çalışıyor mu →', await page())

// 2) Sınav (odak): hızlı kaydırmalar
await send('Page.navigate', { url: BASE + '/yds-sorular/sinav/yds-2018-aralik' })
await sleep(3000)
const q = () => evaluate(`(document.querySelector('[data-focus-stage]')?.innerText.match(/Soru (\\d+)/) || [])[1]`)
console.log('sınav başlangıç:', await q())
for (let i = 0; i < 10; i++) await swipe(1, 450, 30)
await sleep(1500)
console.log('  10 hızlı ileri kaydırma →', await q(), '| artık kopya:', await leftovers())
for (let i = 0; i < 10; i++) await swipe(i % 2 ? 1 : -1, 450, 0)
await sleep(1500)
console.log('  10 hızlı ileri-geri (aralıksız) →', await q(), '| artık kopya:', await leftovers())
await swipe(1, 450, 1200)
console.log('  sonra tek kaydırma →', await q(), '| artık kopya:', await leftovers())
// Ok tuşu yağmuru
for (let i = 0; i < 12; i++) await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); true`)
await sleep(1500)
console.log('  12 hızlı → tuşu →', await q(), '| artık kopya:', await leftovers())

// 3) Kelime kartı
await send('Page.navigate', { url: BASE + '/study?group=all_words&auto=1' })
await sleep(3000)
const term = () => evaluate(`document.querySelector('[data-focus-stage]')?.innerText.split(String.fromCharCode(10)).find(l => /^[a-z ]+$/.test(l.trim()) && l.trim().length > 2)`)
console.log('kart başlangıç:', await term())
for (let i = 0; i < 10; i++) await swipe(i % 3 === 2 ? -1 : 1, 500, 20)
await sleep(1500)
console.log('  10 hızlı kaydırma →', await term(), '| artık kopya:', await leftovers())
await swipe(1, 500, 1200)
console.log('  sonra tek kaydırma →', await term())
console.log('konsol:', logs.slice(0, 10).join('\n') || '(hata yok)')
ws.close()
proc.kill()
