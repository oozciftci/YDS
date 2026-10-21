// Odak düğmesi hep sağ üstte mi, odakta kelime balonu görünüyor mu, sürüm etiketi — başsız Chrome, telefon boyutu.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-corner')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9339/json/list')).json()
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
const rect = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'yok'; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(',') })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

await send('Page.navigate', { url: BASE + '/yds-sorular/sinav/yds-2018-aralik' })
await sleep(3000)
console.log('sürüm etiketi:', JSON.stringify(await evaluate(`document.querySelector('[title="Uygulama sürümü"]')?.innerText`)))
console.log('Odak düğmesi (normal):', await rect('button[aria-label="Odak modu"]'))
await shot('c1-normal.png')
await evaluate(`document.querySelector('button[aria-label="Odak modu"]').click(); true`)
await sleep(600)
console.log('Çıkış düğmesi (odak):', await rect('button[title^="Odak modundan çık"]'))
// Odakta bir kelimeye dokun → balon
const w = JSON.parse(await evaluate(`(() => { const b = document.querySelectorAll('[data-focus-stage] button[class*=_word_]')[4]; const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.left + 4, y: r.top + r.height / 2, t: b.textContent }) })()`))
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w.x, y: w.y }] })
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await sleep(900)
console.log('odakta balon:', w.t, '→', await evaluate(`(() => { const d = document.querySelector('[role=dialog]'); if (!d) return 'yok'; const r = d.getBoundingClientRect(); return getComputedStyle(d).display + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + d.querySelector('strong')?.textContent })()`))
await shot('c2-odak-balon.png')

// Kitap: odak → çıkış düğmesi aynı yerde mi
await send('Page.navigate', { url: BASE + '/kitap/essential-grammar-in-use/s/18' })
await sleep(2500)
console.log('kitap çıkış (odak):', await rect('button[aria-label="Odak modundan çık"]'), '| pill ✕ kaldı mı:', await evaluate(`[...document.querySelectorAll('[class*=_pill_] button')].map(b => b.textContent.trim()).join(' ')`))
await shot('c3-kitap.png')
await evaluate(`document.querySelector('button[aria-label="Odak modundan çık"]').click(); true`)
await sleep(600)
console.log('kitap çıkınca normal okuyucu:', await evaluate(`!document.querySelector('[class*=focusFrame]') && !!document.querySelector('header') && getComputedStyle(document.querySelector('header')).display`))
console.log('konsol:', logs.slice(0, 8).join('\n') || '(hata yok)')
ws.close()
proc.kill()
