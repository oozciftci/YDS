// Kaydırmayı şık/kelime üstünden başlat (dokunulan öğe yeni soruda yok olur): kopya takılı kalıyor mu? Hızlı art arda.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, label] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-stuck')
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
const leftovers = () => evaluate(`document.querySelectorAll('[data-page-turn], div[data-focus-keep][aria-hidden]').length`)
async function swipeFrom(sel, dir, gap) {
  const p = JSON.parse(await evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => { const r = x.getBoundingClientRect(); return r.width > 30 && r.top > 60 && r.bottom < 800 }); if (!e) return 'null'; const r = e.getBoundingClientRect(); return JSON.stringify({ x: Math.min(330, r.left + r.width * 0.7), y: r.top + r.height / 2 }) })()`))
  if (!p) return false
  await touch('touchStart', [[p.x, p.y]])
  for (let i = 1; i <= 7; i++) {
    await touch('touchMove', [[p.x - dir * i * 28, p.y + i]])
    await sleep(10)
  }
  await touch('touchEnd', [])
  await sleep(gap)
  return true
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1500)
await evaluate(`(async () => {
  const { bulkCreateWords } = await import('/src/services/words.ts')
  await bulkCreateWords('user_ozgur', ['because of', 'benefit', 'consider', 'decline', 'emerge', 'foster', 'grasp', 'hinder'].map((t) => ({ term: t, definition: 'anlam ' + t, partOfSpeech: 'verb' })))
  return true
})()`)

// Sınav (normal mod): şık üstünden hızlı ileri kaydırmalar
await send('Page.navigate', { url: BASE + '/yds-sorular/sinav/yds-2018-aralik' })
await sleep(3000)
const q = () => evaluate(`(document.querySelector('[data-focus-stage]')?.innerText.match(/Soru (\\d+)/) || [])[1]`)
const r = [await q()]
for (let i = 0; i < 6; i++) { await swipeFrom('[data-focus-stage] [role=group] button, [data-focus-stage] button[class*=option], [data-focus-stage] [class*=_opt]', 1, 120); r.push(await q()) }
await sleep(1200)
console.log(label, 'sınav (şıktan kaydırma):', r.join(' → '), '| takılı kopya:', await leftovers())
for (let i = 0; i < 6; i++) await swipeFrom('[data-focus-stage] button[class*=_word_]', i % 2 ? 1 : -1, 60)
await sleep(1500)
console.log(label, 'sınav (kelimeden ileri-geri, hızlı):', await q(), '| takılı kopya:', await leftovers())
await shot(`stuck-${label}-sinav.png`)

// Kelime kartı: kelimenin üstünden
await send('Page.navigate', { url: BASE + '/study?group=all_words&auto=1' })
await sleep(3000)
const term = () => evaluate(`document.querySelector('[data-focus-stage]')?.innerText.split(String.fromCharCode(10)).find(l => /^[a-z ]+$/.test(l.trim()) && l.trim().length > 2)`)
const k = [await term()]
for (let i = 0; i < 6; i++) { await swipeFrom('[data-focus-stage] h2, [data-focus-stage] [class*=term], [data-focus-stage] button', 1, 100); k.push(await term()) }
await sleep(1500)
console.log(label, 'kart:', k.join(' → '), '| takılı kopya:', await leftovers())
await shot(`stuck-${label}-kart.png`)
console.log('konsol:', logs.slice(0, 6).join('\n') || '(hata yok)')
ws.close()
proc.kill()
