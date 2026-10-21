// Okuma kitapları: listede kitaplar, kaldığın yerden açma, sayfa çevirme (kaydırma), bölüm seçici, paragraf düzeni,
// hazır çeviri (özgün) ve internetten çeviri (yerel kitap), bölüm sonu sorular, yatay taşma.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, label = 'oku'] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-book')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9345', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9345/json/list')).json()
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

await send('Page.navigate', { url: BASE + '/okuma' })
await sleep(3500)
console.log(label, 'liste:', await evaluate(`JSON.stringify({ kitap: [...document.querySelectorAll('a[href*="/okuma/kitap/"]')].map(a => a.innerText.split(String.fromCharCode(10))[0]), innerWidth })`))
await shot(`book-${label}-liste.png`)

// Özgün uyarlama: hazır çeviri ve anlam
await send('Page.navigate', { url: BASE + '/okuma/kitap/a2-canterville' })
await sleep(3000)
const state = () => evaluate(`JSON.stringify({ url: location.pathname, h1: document.querySelector('h1')?.textContent, info: (document.querySelector('h1')?.nextElementSibling?.textContent || '').split(' · ').slice(1, 3).join(' · '), paras: document.querySelectorAll('[data-focus-stage] p').length, innerWidth })`)
console.log(label, 'açılış:', await state())
await evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.includes('Çeviriler'))?.querySelector('input')?.click()`)
await sleep(500)
console.log(label, 'hazır çeviri:', await evaluate(`[...document.querySelectorAll('[class*=_trLine_]')].slice(0, 2).map(e => e.textContent).join(' | ')`))
await evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.includes('Çeviriler'))?.querySelector('input')?.click()`)
await evaluate(`[...document.querySelectorAll('[data-focus-stage] button[class*=_word_]')].find(b => b.textContent === 'minister')?.click()`)
await sleep(700)
console.log(label, 'minister:', await evaluate(`document.querySelector('[role=dialog]')?.innerText.split(String.fromCharCode(10)).filter(Boolean).slice(0, 3).join(' | ')`))
await evaluate(`document.body.click()`)
for (let i = 0; i < 2; i++) await swipeFrom('[data-focus-stage] button[class*=_word_]', 1, 900)
console.log(label, '2 ileri:', await state(), '| takılı kopya:', await leftovers())
// Bölüm seçici: 5. bölüm
await evaluate(`(() => { const s = document.querySelector('select[aria-label="Bölüme git"]'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
await sleep(1200)
console.log(label, '5. bölüm:', await state())
// Son sayfaya git, bitir, sorular
let guard = 0
while (guard++ < 10 && !(await evaluate(`document.body.innerText.includes('Kitabı bitirdin') || !document.querySelector('h1')`))) {
  const before = await evaluate('location.pathname')
  await swipeFrom('[data-focus-stage] button[class*=_word_]', 1, 900)
  if ((await evaluate('location.pathname')) === before) break
}
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Okumayı bitirdim'))?.click()`)
await sleep(900)
console.log(label, 'son sayfa:', await state(), '| sorular:', await evaluate(`document.querySelectorAll('[class*=_q_]').length`), '| bitti yazısı:', await evaluate(`document.body.innerText.includes('Kitabı bitirdin')`))
await shot(`book-${label}-son.png`)

// Kaldığın yer: kütüphaneden açınca son sayfaya döner
await send('Page.navigate', { url: BASE + '/okuma/kitap/a2-canterville' })
await sleep(2500)
console.log(label, 'kaldığın yer:', await evaluate('location.pathname'))

// Yerel kitap: internetten çeviri (sahte yanıt yok; gerçek ağ) + paragraf düzeni
await send('Page.navigate', { url: BASE + '/okuma/kitap/sherlock-return-a2' })
await sleep(3500)
console.log(label, 'yerel kitap:', await state())
await evaluate(`document.querySelector('[data-focus-stage] button[class*=_badge_]')?.click()`)
await sleep(3500)
console.log(label, 'internetten çeviri:', await evaluate(`document.querySelector('[class*=_trLine_]')?.textContent`))
await shot(`book-${label}-yerel.png`)
await send('Page.navigate', { url: BASE + '/okuma/kitap/mf-sherlock-4000/40' })
await sleep(3500)
console.log(label, 'uzun kitap s.40:', await state(), '| kelime düğmesi:', await evaluate(`document.querySelectorAll('[data-focus-stage] button[class*=_word_]').length`))
console.log('konsol:', logs.slice(0, 6).join('\n') || '(hata yok)')
ws.close()
proc.kill()
