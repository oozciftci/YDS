// Odak modu (yalnızca ana alan, kaydırma kilidi) ve genel sayfa çevirme — başsız Chrome, telefon boyutu, gerçek dokunma.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-focus')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9338', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9338/json/list')).json()
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
// Çapraz bir kaydırma (yatay + biraz dikey): kart dikeyde oynamamalı
async function drag(dir, y, steps, hold = false) {
  const x0 = dir === 1 ? 330 : 60
  await touch('touchStart', [[x0, y]])
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [[x0 - dir * i * 22, y + i * 6]])
    await sleep(16)
  }
  if (!hold) {
    await touch('touchEnd', [])
    await sleep(900)
  }
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1500)
await evaluate(`(async () => {
  const { bulkCreateWords } = await import('/src/services/words.ts')
  await bulkCreateWords('user_ozgur', ['because of', 'benefit', 'consider', 'decline', 'emerge'].map((t) => ({ term: t, definition: 'anlam ' + t, partOfSpeech: 'verb' })))
  localStorage.setItem('yds-focus', '1')
  return true
})()`)

// 1) Kelime kartı, odak modu
await send('Page.navigate', { url: BASE + '/study?group=all_words&auto=1' })
await sleep(3000)
const state = () => evaluate(`JSON.stringify({
  idx: (document.body.innerText.match(/Soru (\\d+) \\/ 5/) || [])[1] || (document.querySelector('[data-focus-stage] h2, [data-focus-stage] [class*=term]')?.textContent),
  term: document.querySelector('[data-focus-stage]')?.innerText.split(String.fromCharCode(10)).find(l => /^[a-z ]+$/.test(l.trim()) && l.trim().length > 2),
  statusVisible: getComputedStyle(document.querySelector('[class*=_statusBar_]')).display,
  headerVisible: getComputedStyle(document.querySelector('header')).display,
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  scrollY: Math.round(scrollY),
  stage: (() => { const r = document.querySelector('[data-focus-stage]').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })(),
})`)
console.log('1a) odak:', await state())
await shot('f1-kart-odak.png')
await drag(1, 500, 7, true)
await sleep(120)
await shot('f2-kart-cevirme.png')
console.log('1b) sürüklerken: kopya var mı', await evaluate(`!!document.querySelector('[data-focus-keep][aria-hidden]')`), '| scrollY', await evaluate('Math.round(scrollY)'))
await touch('touchEnd', [])
await sleep(900)
console.log('1c) bıraktıktan sonra:', await state(), '| kopya kaldı mı', await evaluate(`!!document.querySelector('div[data-focus-keep][aria-hidden]')`))
// Yarıda vazgeçme: kısa sürükle, yavaş bırak
const before = JSON.parse(await state()).term
await touch('touchStart', [[330, 500]])
for (let i = 1; i <= 3; i++) { await touch('touchMove', [[330 - i * 12, 500]]); await sleep(120) }
await sleep(300)
await touch('touchEnd', [])
await sleep(900)
console.log('1d) vazgeçince aynı kart:', before, '→', JSON.parse(await state()).term)
// Geri (aynalı)
await drag(-1, 500, 7, true)
await sleep(120)
await shot('f3-kart-geri.png')
await touch('touchEnd', [])
await sleep(900)
console.log('1e) geri sonrası:', JSON.parse(await state()).term)

// 2) Çıkmış sınav, odak modu
await send('Page.navigate', { url: BASE + '/yds-sorular/sinav/yds-2018-aralik' })
await sleep(3000)
console.log('2a) sınav odak:', await evaluate(`JSON.stringify({ toolbarHidden: getComputedStyle(document.querySelector('[class*=_toolbar_]')).display, navHidden: [...document.querySelectorAll('main nav, main [class*=qnav], main [class*=QuestionNav]')].map(e => getComputedStyle(e).display).join(','), stage: (() => { const r = document.querySelector('[data-focus-stage]').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)] })(), scrollY })`))
await shot('f4-sinav-odak.png')
await drag(1, 450, 7, true)
await sleep(120)
await shot('f5-sinav-cevirme.png')
await touch('touchEnd', [])
await sleep(900)
console.log('2b) sınav soru:', await evaluate(`document.querySelector('[data-focus-stage]')?.innerText.slice(0, 60).split(String.fromCharCode(10)).join(' | ')`))

// 3) Kitap: genel odak → kitap tam ekran
await send('Page.navigate', { url: BASE + '/kitap/essential-grammar-in-use/s/18' })
await sleep(2500)
console.log('3) kitap tam ekran:', await evaluate(`!!document.querySelector('[class*=focusFrame]')`))
console.log('konsol:', logs.slice(0, 8).join('\n') || '(hata yok)')
ws.close()
proc.kill()
