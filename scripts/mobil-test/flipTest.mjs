// Sayfa çevirme animasyonunu başsız Chrome'da (rAF çalışır) telefon boyutunda dener ve ara kareleri kaydeder.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-flip')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9335/json/list')).json()
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
const shot = async (name) => fs.writeFileSync(path.join(outDir, name), Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1500)
await evaluate(`localStorage.setItem('yds-book-mode', 'half'); localStorage.setItem('yds-book-focus', '1'); true`)

// 1) Yarım sayfa: aynı sayfanın üst → alt yarısı (dikey kayma)
await send('Page.navigate', { url: BASE + '/kitap/essential-grammar-in-use/s/20' })
await sleep(2500)
console.log('1) kayma:', await evaluate(`(async () => {
  const f = document.querySelector('[class*=focusFrame]'); const r = f.getBoundingClientRect()
  const s = []; const iv = setInterval(() => s.push([...f.querySelectorAll(':scope > [class*=_sheet_]')].map(x => (x.style.transform || '-').slice(0, 22)).join(' | ')), 70)
  f.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.right - 15, clientY: r.top + r.height / 2 }))
  await new Promise(r => setTimeout(r, 600)); clearInterval(iv)
  return JSON.stringify({ s: s.slice(0, 4), url: location.pathname + location.search })
})()`))

// 2) Sayfa değişimi (alt yarı → sonraki sayfanın üst yarısı): katlanma; ortasında ekran görüntüsü
console.log('2) katlanma:', await evaluate(`(() => {
  const f = document.querySelector('[class*=focusFrame]'); const r = f.getBoundingClientRect()
  f.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.right - 15, clientY: r.top + r.height / 2 }))
  return 'tıklandı'
})()`))
await sleep(280)
await shot('flip-mid1.png')
await sleep(140)
await shot('flip-mid2.png')
await sleep(600)
console.log('   sonra:', await evaluate(`location.pathname + location.search`))

// 3) Tam sayfa, geri çevirme ortası
await evaluate(`localStorage.setItem('yds-book-mode', 'full'); true`)
await send('Page.navigate', { url: BASE + '/kitap/essential-grammar-in-use/s/22' })
await sleep(2500)
await evaluate(`(() => { const f = document.querySelector('[class*=focusFrame]'); const r = f.getBoundingClientRect(); f.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 15, clientY: r.top + r.height / 2 })); return 1 })()`)
await sleep(330)
await shot('flip-back.png')
await sleep(800)
console.log('3) geri sonra:', await evaluate(`location.pathname`))
console.log('konsol:', logs.slice(0, 10).join('\n') || '(hata yok)')
ws.close()
proc.kill()
