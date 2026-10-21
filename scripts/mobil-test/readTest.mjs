// Okuma Modu ve ek testi: kaydırarak önceki/sonraki (kelime/şık üstünden başlatarak), takılı kopya, paragrafta süre
// sıfırlanması, odak modunda yalnızca metin + süre + Bitir.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, label = 'oku'] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-read')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9343', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9343/json/list')).json()
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
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

// Okuma Modu: 2018 Aralık'ın ilk okuma paragrafı
await send('Page.navigate', { url: BASE + '/yds-sorular/okuma' })
await sleep(3000)
const first = await evaluate(`[...document.querySelectorAll('a[href*="/okuma/yds-2018-aralik/"]')][0]?.getAttribute('href')`)
await send('Page.navigate', { url: BASE + first })
await sleep(3500)
const para = () => evaluate(`(document.querySelector('h1')?.textContent.match(/Paragraf (\\d+)/) || [])[1]`)
const timer = () => evaluate(`document.querySelector('[title="Okuma süresi"]')?.textContent.trim()`)
const p0 = await para()
console.log(label, 'başlangıç: paragraf', p0, '| süre', await timer())
const r = [p0]
for (let i = 0; i < 3; i++) { await swipeFrom('[data-focus-stage] button[class*=_word_]', 1, 900); r.push(await para()) }
console.log(label, 'ileri (kelimeden):', r.join(' → '), '| süre', await timer(), '| scrollY', await evaluate('Math.round(scrollY)'), '| takılı kopya:', await leftovers())
await swipeFrom('[data-focus-stage] button[class*=_word_]', -1, 900)
console.log(label, 'geri:', await para(), '| geçmiş uzunluğu', await evaluate('history.length'))
for (let i = 0; i < 8; i++) await swipeFrom('[data-focus-stage] button[class*=_word_]', i % 3 ? 1 : -1, 50)
await sleep(1500)
console.log(label, 'hızlı ileri-geri:', await para(), '| takılı kopya:', await leftovers())
// İlk paragrafta geri: yaylanır, sayfa değişmez
await send('Page.navigate', { url: BASE + first })
await sleep(3000)
await swipeFrom('[data-focus-stage] button[class*=_word_]', -1, 700)
console.log(label, 'ilk paragrafta geri:', await para(), '| takılı kopya:', await leftovers())
await shot(`read-${label}-normal.png`)

// Odak modu
await evaluate(`localStorage.setItem('yds-focus', '1')`)
await send('Page.reload')
await sleep(3500)
const vis = () => evaluate(`JSON.stringify({ stage: (() => { const r = document.querySelector('[data-focus-stage]').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })(), timer: !!document.querySelector('[title="Okuma süresi"]')?.offsetParent, finish: [...document.querySelectorAll('button')].some(b => b.textContent.includes('Okumayı bitirdim') && b.offsetParent), h1: !!document.querySelector('h1')?.offsetParent, listen: [...document.querySelectorAll('button')].some(b => /Dinle/.test(b.textContent) && b.offsetParent), scrollY })`)
console.log(label, 'odak:', await vis())
await swipeFrom('[data-focus-stage] button[class*=_word_]', 1, 900)
console.log(label, 'odakta ileri:', await para(), '| takılı kopya:', await leftovers(), '| alan', await vis())
await shot(`read-${label}-odak.png`)
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Okumayı bitirdim'))?.click()`)
await sleep(800)
console.log(label, 'odakta bitirince:', await vis(), '| sonuç görünür:', await evaluate(`/kelime\\/dk/.test(document.querySelector('main').innerText)`))
await shot(`read-${label}-odak-bitti.png`)
await evaluate(`localStorage.removeItem('yds-focus')`)

// Ek testi
await send('Page.navigate', { url: BASE + '/kelime-ailesi' })
await sleep(2500)
await evaluate(`[...document.querySelectorAll('[role=tab]')].find(b => b.textContent.includes('Ek testi'))?.click()`)
await sleep(500)
const affix = () => evaluate(`document.querySelector('[data-focus-stage] [class*=bigAffix]')?.textContent`)
const a0 = await affix()
await evaluate(`document.querySelector('[data-focus-stage] [class*=quizBtn]')?.click()`)
await sleep(300)
await swipeFrom('[data-focus-stage] [class*=quizBtn]', 1, 900)
const a1 = await affix()
await swipeFrom('[data-focus-stage] [class*=quizBtn]', -1, 900)
const back = await evaluate(`JSON.stringify({ affix: document.querySelector('[data-focus-stage] [class*=bigAffix]')?.textContent, locked: [...document.querySelectorAll('[data-focus-stage] [class*=quizBtn]')].every(b => b.disabled), score: document.querySelector('[data-focus-stage] .muted')?.textContent })`)
console.log(label, 'ek testi:', a0, '→', a1, '| geri:', back, '| takılı kopya:', await leftovers())
await shot(`read-${label}-ek.png`)
console.log('konsol:', logs.slice(0, 6).join('\n') || '(hata yok)')
ws.close()
proc.kill()
