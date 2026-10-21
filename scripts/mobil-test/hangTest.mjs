// Odak modunda sınavda aralıksız ileri-geri kaydırma: sayfa donuyor mu, nerede? Profil ile ölç.
import { spawn } from 'node:child_process'
import path from 'node:path'

const [, , outDir, focusOn] = process.argv
const BASE = 'http://localhost:5176'
const prof = path.join(outDir, 'prof-hang')
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
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
  if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 600))
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 600))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => 'ZAMAN AŞIMI')])
const evaluate = async (expr, ms = 8000) => { const r = await withTimeout(send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), ms); return typeof r === 'string' ? r : r.result?.result?.value }
const touch = (type, pts) => withTimeout(send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) }), 4000)

await send('Page.enable')
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Page.frameNavigated' || m.method === 'Page.navigatedWithinDocument') console.log('   GEZİNME:', m.method, (m.params.frame?.url || m.params.url)) })
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1200)
await evaluate(`localStorage.setItem('yds-focus', '${focusOn}'); true`)
await send('Page.navigate', { url: BASE + '/yds-sorular/sinav/yds-2018-aralik' })
await sleep(3000)
console.log('önce:', await evaluate(`document.body.innerText.slice(0, 80)`))
const t0 = Date.now()
for (let i = 0; i < 10; i++) {
  const dir = i % 2 ? 1 : -1
  const x0 = dir === 1 ? 330 : 60
  const r = await touch('touchStart', [[x0, 450]])
  if (r === 'ZAMAN AŞIMI') { console.log('dokunma', i, 'zaman aşımı'); break }
  for (let k = 1; k <= 6; k++) await touch('touchMove', [[x0 - dir * k * 30, 450]])
  await touch('touchEnd', [])
  console.log(i, dir, 'tamam', Date.now() - t0, 'ms', await evaluate(`location.pathname + ' h' + history.length + ' ' + ((document.querySelector('[data-focus-stage]')?.innerText.match(/Soru (\d+)/) || [])[1])`, 3000))
}
const s = Date.now()
console.log('yanıt:', await evaluate(`JSON.stringify({ q: (document.querySelector('[data-focus-stage]')?.innerText.match(/Soru (\\d+)/) || [])[1], kopya: document.querySelectorAll('[data-page-turn]').length, off: document.querySelectorAll('[data-focus-off]').length, n: document.querySelectorAll('main *').length })`, 20000), Date.now() - s, 'ms')
console.log('body:', await evaluate(`document.body.innerText.slice(0, 300)`))
console.log('konsol:', logs.slice(0, 6).join(' ||| ') || '(hata yok)')
ws.close()
proc.kill()
