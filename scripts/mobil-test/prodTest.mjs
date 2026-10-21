// Yayın derlemesini (vite preview, /YDS/) başsız Chrome'da telefon boyutunda dener: kaynak paketini yükle → bölümleri aç.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, bundle] = process.argv
const BASE = 'http://localhost:4173/YDS'
const prof = path.join(outDir, 'prof-prod')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9334/json/list')).json()
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
  if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 300))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (name) => fs.writeFileSync(path.join(outDir, name), Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'))
const go = async (p, wait = 3000) => { await send('Page.navigate', { url: BASE + p }); await sleep(wait) }

await send('Page.enable')
await send('Runtime.enable')
await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })

await go('/kitap')
console.log('0) paketsiz /kitap:', await evaluate(`document.querySelector('main')?.innerText.slice(0, 120)`))
await go('/settings')
console.log('1) kart:', await evaluate(`document.getElementById('yerel-kaynaklar')?.innerText.slice(0, 160)`))
const doc = await send('DOM.getDocument', { depth: -1 })
const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#yerel-kaynaklar > div > input[type=file]' })
const t0 = Date.now()
await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [bundle] })
for (let i = 0; i < 240; i++) {
  await sleep(1000)
  const s = await evaluate(`localStorage.getItem('yds-local-content')`)
  if (s) { console.log(`2) yüklendi (${Math.round((Date.now() - t0) / 1000)} sn):`, s.slice(0, 200)); break }
}
await sleep(3000)
console.log('   kart:', await evaluate(`document.getElementById('yerel-kaynaklar')?.innerText.slice(0, 300)`))
await shot('p1-ayarlar.png')

await go('/kitap/essential-grammar-in-use', 4000)
console.log('3) kitap:', await evaluate(`location.pathname + ' | img ' + (document.querySelector('main img')?.naturalWidth ?? 'yok')`))
await shot('p2-kitap.png')
await go('/yds-sorular', 4000)
console.log('4) soru merkezi:', await evaluate(`document.querySelector('main')?.innerText.slice(0, 200).replace(/\\n/g, ' | ')`))
await go('/yds-sorular/sinav/yds-2018-aralik', 4000)
console.log('5) sınav:', await evaluate(`document.querySelector('main')?.innerText.slice(0, 250).replace(/\\n/g, ' | ')`))
await shot('p3-sinav.png')
await go('/yds-sorular/bankalar/strateji-3', 4000)
// bölümler kapalı olabilir: önce hepsini aç, sonra ilk "Çöz"
await evaluate(`[...document.querySelectorAll('main button, main [role=button], main summary')].find(b => b.textContent.includes('Tenses'))?.click(); true`)
await sleep(500)
const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Çöz'); if (!b) return document.querySelector('main')?.innerText.slice(0, 200); b.click(); return 'tıklandı' })()`)
console.log('6) strateji-3:', clicked)
await sleep(4000)
console.log('   adres:', await evaluate('location.pathname'), '| görüntü:', await evaluate(`[...document.querySelectorAll('main img')].map(i => i.naturalWidth).join(',') || 'yok'`))
await shot('p4-strateji.png')
console.log('7) yatay taşma:', await evaluate('innerWidth'))
console.log('8) SW:', await evaluate(`navigator.serviceWorker.controller ? 'denetliyor' : 'yok'`))
await send('Network.enable')
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
await go('/kitap/essential-grammar-in-use/s/40', 4000)
console.log('9) internetsiz kitap:', await evaluate(`location.pathname + ' | img ' + (document.querySelector('main img')?.naturalWidth ?? 'yok') + ' | ' + (document.body.innerText.slice(0, 60).replace(/\n/g, ' '))`))
await go('/yds-sorular/sinav/yds-2016-ilkbahar', 4000)
console.log('10) internetsiz sınav:', await evaluate(`(document.querySelector('main')?.innerText || 'yok').slice(0, 120).replace(/\n/g, ' | ')`))
await shot('p5-cevrimdisi.png')
console.log('konsol:', logs.slice(0, 12).join('\n') || '(hata yok)')
ws.close()
proc.kill()
