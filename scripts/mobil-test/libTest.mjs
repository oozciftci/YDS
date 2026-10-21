// Okuma Kütüphanesi: liste, metne özgü kelime anlamı, kaydırarak metin geçişi, bitirince sorular + özet, kayıt,
// odak modunda alanın ekrana sığması, yatay taşma (innerWidth).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, label = 'oku'] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-lib')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9344/json/list')).json()
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
  const p = JSON.parse(await evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => { const r = x.getBoundingClientRect(); return r.width > 20 && r.top > 60 && r.bottom < 800 }); if (!e) return 'null'; const r = e.getBoundingClientRect(); return JSON.stringify({ x: Math.min(330, Math.max(60, r.left + r.width * 0.7)), y: r.top + r.height / 2 }) })()`))
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
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

// Liste
await send('Page.navigate', { url: BASE + '/okuma' })
await sleep(3000)
console.log(label, 'liste:', await evaluate(`JSON.stringify({ rows: document.querySelectorAll('a[href*="/okuma/"]').length, groups: [...document.querySelectorAll('h3')].map(h => h.textContent.slice(0, 20)), innerWidth })`))
await shot(`lib-${label}-liste.png`)
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'B1')?.click()`)
await sleep(300)
console.log(label, 'B1 süzgeci:', await evaluate(`document.querySelectorAll('a[href*="/okuma/b1"]').length + ' B1, ' + document.querySelectorAll('a[href*="/okuma/a2"]').length + ' A2'`))
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Tümü')?.click()`)

// Okuyucu: metne özgü anlam
await send('Page.navigate', { url: BASE + '/okuma/a2-uyku' })
await sleep(3000)
const tapWord = async (w) => {
  await evaluate(`[...document.querySelectorAll('[data-focus-stage] button[class*=_word_]')].find(b => b.textContent === ${JSON.stringify(w)})?.click()`)
  await sleep(700)
  return evaluate(`document.querySelector('[role=dialog]')?.innerText.split(String.fromCharCode(10)).slice(0, 5).join(' | ')`)
}
console.log(label, 'muscles:', await tapWord('muscles'))
console.log(label, 'However:', await tapWord('However'))
const title = () => evaluate(`document.querySelector('h1')?.textContent`)
const t0 = await title()
await swipeFrom('[data-focus-stage] button[class*=_word_]', 1, 900)
const t1 = await title()
await swipeFrom('[data-focus-stage] button[class*=_word_]', -1, 900)
console.log(label, 'kaydırma:', t0, '→', t1, '→', await title(), '| takılı kopya:', await leftovers(), '| geçmiş', await evaluate('history.length'))
for (let i = 0; i < 8; i++) await swipeFrom('[data-focus-stage] button[class*=_word_]', i % 3 ? 1 : -1, 50)
await sleep(1500)
console.log(label, 'hızlı kaydırma sonrası:', await title(), '| takılı kopya:', await leftovers())

// Bitir → sorular, özet, kayıt
await send('Page.navigate', { url: BASE + '/okuma/b1-matbaa' })
await sleep(3000)
await sleep(4000)
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Okumayı bitirdim'))?.click()`)
await sleep(800)
const opts = await evaluate(`document.querySelectorAll('[class*=_opt_]').length`)
// Her sorunun ilk şıkkı
await evaluate(`(() => { const qs = [...document.querySelectorAll('[class*=_q_]')]; qs.forEach(q => q.querySelector('[class*=_opt_]')?.click()) })()`)
await sleep(500)
console.log(label, 'sorular:', opts, 'şık |', await evaluate(`document.querySelector('[class*=_score_]')?.textContent`), '| açıklama:', await evaluate(`document.querySelectorAll('[class*=_why_]').length`))
console.log(label, 'kayıt:', await evaluate(`JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('yds-reading:')).flatMap(k => Object.entries(JSON.parse(localStorage.getItem(k))).filter(([id]) => id.startsWith('lib/'))))`))
await shot(`lib-${label}-bitti.png`)

// Odak modu
await evaluate(`localStorage.setItem('yds-focus', '1')`)
await send('Page.navigate', { url: BASE + '/okuma/b1-isi-adasi' })
await sleep(3500)
const vis = () => evaluate(`JSON.stringify({ stage: (() => { const r = document.querySelector('[data-focus-stage]').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })(), h1: !!document.querySelector('h1')?.offsetParent, scrollY, innerWidth })`)
console.log(label, 'odak:', await vis())
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Okumayı bitirdim'))?.click()`)
await sleep(1200)
console.log(label, 'odakta bitirince:', await vis(), '| sorular görünür:', await evaluate(`!!document.querySelector('[class*=_quiz_]')?.offsetParent`))
await shot(`lib-${label}-odak.png`)
await evaluate(`localStorage.removeItem('yds-focus')`)

// Liste: okundu işareti
await send('Page.navigate', { url: BASE + '/okuma' })
await sleep(2500)
console.log(label, 'listede matbaa:', await evaluate(`[...document.querySelectorAll('a[href$="b1-matbaa"]')][0]?.innerText.split(String.fromCharCode(10)).join(' | ')`))
console.log('konsol:', logs.slice(0, 6).join('\n') || '(hata yok)')
ws.close()
proc.kill()
