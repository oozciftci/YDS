// Yapışkan notlar ("Bu sayfa") ve Defterim — başsız Chrome, telefon boyutu, gerçek dokunma olayları, sahte mikrofon.
// Dener: "Bu sayfa" doğrudan yapışkan notu açar (renk seçmeden), yazma alanı odaklı ve yazılabilir; metin + sesli not +
// metin sırayla akışta; notu parmakla taşıma, köşeden boyutlandırma, yenileyince yerinde; dokununca açılıp açık kalma
// (iOS hayalet tıklaması); SAYFA YENİLENDİKTEN SONRA sesli notun çalınması (yapışkan not ve Defterim); ses bayt olarak
// saklanır; not soruya özgü (sonraki soruda yok, dönünce var), geçişte sayfa en üstten; boş bırakılan not silinir;
// eski biçimdeki notlar (tek metinli sayfa notu, Blob'lu ses) yeni biçime taşınır; DUS metin görünümü, yatay odak.
// Kullanım: MSYS_NO_PATHCONV=1 node scripts/mobil-test/stickyTest.mjs "<çıktı klasörü>" [taban adres, varsayılan 5176]
// Kendi Chrome profilini kullanır (çıktı klasöründe); o profildeki notları siler, gerçek notlara dokunmaz.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [, , outDir, BASE = 'http://localhost:5176'] = process.argv
const PAGE = '/dus/2012-ilkbahar/tbt'
fs.mkdirSync(outDir, { recursive: true })
const prof = path.join(outDir, 'prof-sticky')
const proc = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--remote-debugging-port=9341', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${prof}`, 'about:blank'],
  { stdio: 'ignore' },
)
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
const evaluate = async (expr) => {
  const r = (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result
  if (r?.exceptionDetails) throw new Error('evaluate: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r?.result?.value
}
const json = async (expr) => JSON.parse(await evaluate(`JSON.stringify(${expr})`))
const shot = async (name) => fs.writeFileSync(path.join(outDir, name), Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'))
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
async function swipe(x0, y0, x1, y1, steps = 8) {
  await touch('touchStart', [[x0, y0]])
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]])
    await sleep(16)
  }
  await touch('touchEnd', [])
  await sleep(500)
}
async function tap(x, y) {
  await touch('touchStart', [[x, y]])
  await sleep(60)
  await touch('touchEnd', [])
}
/** Seçilen öğenin ortasına dokunur (yoksa hata) */
async function tapEl(expr, wait = 500) {
  const c = await json(`(() => { const e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
  if (!c) throw new Error('öğe yok: ' + expr)
  await tap(c.x, c.y)
  await sleep(wait)
}
async function typeLine(text) {
  await send('Input.insertText', { text })
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await sleep(400)
}
const load = async (url = BASE + PAGE) => {
  await send('Page.navigate', { url })
  await sleep(2500)
}
const rect = (sel) => json(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const s = e.style; return { l: parseFloat(s.left), t: parseFloat(s.top), w: parseFloat(s.width), h: parseFloat(s.height) } })()`)
const STICKY = '[aria-label="Yapışkan not (aç)"]'
const DLG = '[role=dialog][aria-label="Yapışkan not"]'
const PILL = `document.querySelector('[title="Bu sayfaya özel yapışkan not"]')`
const btn = (scope, label) => `[...document.querySelectorAll('${scope} button')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)})`
const navBtn = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}))`
const isOpen = () => evaluate(`!!document.querySelector('${DLG}')`)
/** Veritabanı satırları (bytes/blob yerine boyutları) */
const rows = async () =>
  JSON.parse(
    await evaluate(
      `(async () => { const { db } = await import('/src/db/index.ts'); return JSON.stringify((await db.notebook.toArray()).map((n) => ({ id: n.id, scope: n.scope, kind: n.kind, text: n.text, parentId: n.parentId, pageKey: n.pageKey, bytes: n.bytes ? n.bytes.byteLength : 0, blob: n.blob ? n.blob.size : 0, mime: n.mime, sec: n.durationSec }))) })()`,
    ),
  )
/** Kayıt başlat → bekle → bitir (scope: düğmelerin arandığı kapsayıcı) */
async function record(scope) {
  await tapEl(btn(scope, 'Sesli not kaydet'), 1800)
  await tapEl(btn(scope, 'Kaydı bitir'), 900)
}
/** Sesli notu çal: düğme "Durdur"a dönmeli, hata yazısı çıkmamalı */
async function plays(scope) {
  await tapEl(btn(scope, 'Sesli notu dinle'), 700)
  return json(`({ playing: !!${btn(scope, 'Durdur')}, error: [...document.querySelectorAll('${scope} [class*=_error_]')].map((e) => e.textContent).join(' ') })`)
}
let fail = 0
const check = (name, ok, extra = '') => {
  if (!ok) fail++
  console.log(`${ok ? 'TAMAM' : 'HATA '} ${name}${extra ? ' — ' + extra : ''}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await load()
// Temiz başlangıç (yalnızca bu deneme profilinde): notlar, DUS cevapları, odak kapalı
await evaluate(`(async () => {
  const { db } = await import('/src/db/index.ts')
  await db.notebook.clear()
  const { resetDusTest } = await import('/src/services/dus.ts')
  const { useUserStore } = await import('/src/stores/user.ts')
  resetDusTest(useUserStore.getState().activeUserId, '2012-ilkbahar', 'tbt')
  localStorage.setItem('yds-focus', '0')
  localStorage.removeItem('yds-notes-open')
  return true
})()`)
await load()

// 1) DUS metin görünümü
const t1 = await json(`({ metin: !!document.querySelector('[class*=_dusText_]'), sik: document.querySelectorAll('[class*=_dusOptBtn_]').length, tasma: document.documentElement.scrollWidth - innerWidth })`)
check('DUS sorusu metin olarak', t1.metin && t1.sik === 5, JSON.stringify(t1))

// 2) "Bu sayfa": renk seçmeden doğrudan yapışkan not; yazma alanı odaklı ve yazılabilir
await tapEl(PILL)
const o1 = await json(`(() => { const d = document.querySelector('${DLG}'); const t = d?.querySelector('textarea'); return { open: !!d, focused: !!t && document.activeElement === t, ro: t?.readOnly, renk: d ? getComputedStyle(d.firstElementChild).backgroundColor : '' } })()`)
check('"Bu sayfa" doğrudan yapışkan notu açıyor (renkli kâğıt)', o1.open && o1.renk === 'rgb(255, 245, 157)', JSON.stringify(o1))
check('yazma alanı odaklı ve yazılabilir (klavye açılır)', o1.focused && o1.ro === false)

// 3) Metin + sesli not + metin: akışta bu sırayla
await typeLine('Birinci not')
await record(DLG)
await tapEl(`document.querySelector('${DLG} textarea')`, 200)
await typeLine('İkinci not')
const feed = await json(`[...document.querySelectorAll('${DLG} article')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim())`)
check('sesli not mesajların arasında (metin, ses, metin)', feed.length === 3 && feed[0].includes('Birinci not') && feed[1].includes('Sesli not') && feed[2].includes('İkinci not'), JSON.stringify(feed))
let db1 = await rows()
const voice = db1.find((r) => r.scope === 'stickyItem' && r.kind === 'audio')
check('ses bayt olarak saklanıyor (Blob değil)', !!voice && voice.bytes > 1000 && voice.blob === 0 && !!voice.mime && voice.sec > 1, JSON.stringify(voice))
await shot('s1-akis.png')
await tapEl(navBtn('Küçült'))
check('"Küçült" notu kapatıyor', !(await isOpen()))
const small = await evaluate(`document.querySelector(${JSON.stringify(STICKY)})?.innerText`)
check('küçük notta yazılar ve 🎤 sayısı', !!small && small.includes('Birinci not') && small.includes('İkinci not') && small.includes('🎤 1'), JSON.stringify(small))

// 4) Taşıma
const r0 = await rect(STICKY)
await swipe(r0.l + 40, r0.t + 40, r0.l + 140, r0.t + 300)
const r1 = await rect(STICKY)
check('parmakla taşıma', Math.abs(r1.l - r0.l - 100) < 6 && Math.abs(r1.t - r0.t - 260) < 6, JSON.stringify([r0, r1]))

// 5) Boyutlandırma (sağ alt köşe)
await swipe(r1.l + r1.w - 8, r1.t + r1.h - 8, r1.l + r1.w + 40, r1.t + r1.h + 60)
const r2 = await rect(STICKY)
check('köşeden boyutlandırma', r2.w > r1.w + 30 && r2.h > r1.h + 50 && Math.abs(r2.l - r1.l) < 2, JSON.stringify([r1, r2]))

// 6) Sayfa yenilenince: not yerinde, dokununca açılıp açık kalıyor (klavye açılmadan), ses ÇALINIYOR
await load()
const r3 = await rect(STICKY)
check('yenileyince yerinde', r3 && Math.abs(r3.l - r2.l) < 2 && Math.abs(r3.t - r2.t) < 2 && Math.abs(r3.w - r2.w) < 2, JSON.stringify(r3))
await tap(r3.l + 30, r3.t + 30)
await sleep(700)
check('dokununca açılıyor ve açık kalıyor', await isOpen())
check('nota dokunup açınca klavye açılmıyor (odak yok)', await evaluate(`document.activeElement?.tagName !== 'TEXTAREA'`))
const p1 = await plays(DLG)
check('yenilendikten sonra yapışkan nottaki ses çalınıyor', p1.playing && !p1.error, JSON.stringify(p1))
await tapEl(btn(DLG, 'Durdur'), 200)

// 7) Arka plana dokununca küçülür
await tap(8, 30)
await sleep(500)
check('arka plana dokununca küçülüyor', !(await isOpen()))

// 8) Sonraki soru: not görünmez, sayfa en üstten; boş bırakılan not kalmaz; önceki soruya dönünce not yerinde
await evaluate('window.scrollTo(0, 400)')
await tapEl(navBtn('Sonraki'), 1200)
const after = await json(`({ y: Math.round(scrollY), sticky: !!document.querySelector(${JSON.stringify(STICKY)}) })`)
check('sonraki soruda not görünmüyor', !after.sticky)
check('sonraki soru en üstten açılıyor', after.y === 0, JSON.stringify(after))
await tapEl(PILL)
check('sonraki soruda "Bu sayfa" yeni boş not açıyor', (await isOpen()) && (await evaluate(`document.querySelectorAll('${DLG} article').length`)) === 0)
await tap(8, 30)
await sleep(600)
check('boş bırakılan not silindi', (await rows()).filter((r) => r.scope === 'sticky').length === 1 && !(await evaluate(`!!document.querySelector(${JSON.stringify(STICKY)})`)))
await tapEl(navBtn('← Önceki'), 1200)
check('önceki soruya dönünce not yerinde', await evaluate(`!!document.querySelector(${JSON.stringify(STICKY)})`))

// 9) Defterim: sesli not, sayfa yenilendikten sonra da çalınıyor
const PANE = '[aria-label="Genel çalışma defteri"]'
await tapEl(`document.querySelector('[title="Genel çalışma defteri"]')`)
await typeLine('Defter notu')
await record(PANE)
const gen = (await rows()).filter((r) => r.scope === 'general')
check('Defterim: metin + ses eklendi, ses bayt olarak', gen.length === 2 && gen.some((r) => r.kind === 'audio' && r.bytes > 1000 && r.blob === 0), JSON.stringify(gen))
await load()
const p2 = await plays(PANE)
check('yenilendikten sonra Defterim’deki ses çalınıyor', p2.playing && !p2.error, JSON.stringify(p2))
await tapEl(btn(PANE, 'Küçült'))

// 10) Eski biçimdeki notlar yeni biçime taşınıyor (tek metinli sayfa notu; içinde metin + Blob'lu ses olan yapışkan not)
await evaluate(`(async () => {
  const { db } = await import('/src/db/index.ts')
  const { useUserStore } = await import('/src/stores/user.ts')
  const u = useUserStore.getState().activeUserId
  const now = new Date().toISOString()
  const audio = (await db.notebook.filter((n) => n.kind === 'audio').first())
  const blob = new Blob([audio.bytes], { type: audio.mime })
  await db.notebook.bulkPut([
    { id: 'page:' + u + ':/eski', userId: u, scope: 'page', pageKey: '/eski', pageLabel: 'Eski', kind: 'text', text: 'Eski sayfa notu', createdAt: now, updatedAt: now },
    { id: 'eski-yapiskan', userId: u, scope: 'sticky', pageKey: '/eski', pageLabel: 'Eski', kind: 'text', text: 'Eski yapışkan', blob, mime: audio.mime, durationSec: 2, sticky: { color: 'mavi', x: 0.3, y: 0.3, w: 160, h: 140 }, createdAt: now, updatedAt: now },
  ])
  localStorage.removeItem('yds-notebook-v2')
  return true
})()`)
await load()
await sleep(500)
const mig = (await rows()).filter((r) => r.pageKey === '/eski')
const box = mig.find((r) => r.scope === 'sticky' && r.id.startsWith('sticky:page:'))
const pageItem = mig.find((r) => r.scope === 'stickyItem' && r.text === 'Eski sayfa notu')
const oldBox = mig.find((r) => r.id === 'eski-yapiskan')
const oldText = mig.find((r) => r.id === 'eski-yapiskan:t')
const oldAudio = mig.find((r) => r.id === 'eski-yapiskan:a')
check('eski sayfa notu → yapışkan not + mesaj', !!box && pageItem?.parentId === box.id && !mig.some((r) => r.scope === 'page'), JSON.stringify(mig.map((r) => [r.id, r.scope, r.kind])))
check('eski yapışkan notun metni ve sesi mesajlara taşındı (ses bayt oldu)', oldBox && !oldBox.text && oldBox.blob === 0 && oldText?.text === 'Eski yapışkan' && oldAudio?.kind === 'audio' && oldAudio.bytes > 1000 && oldAudio.blob === 0, JSON.stringify([oldBox, oldText, oldAudio]))

// 11) Yatay telefon + odak modu: taşma yok, şıklar ekranda
await evaluate(`localStorage.setItem('yds-focus', '1')`)
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true })
await load()
const land = await json(`({ tasma: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle(document.querySelector('[class*=_dusText_]')).gridTemplateColumns.split(' ').length, sonSik: Math.round(document.querySelectorAll('[class*=_dusOptBtn_]')[4].getBoundingClientRect().bottom), h: innerHeight })`)
check('yatay odakta iki sütun, taşma yok, E şıkkı ekranda', land.tasma === 0 && land.cols === 2 && land.sonSik <= land.h, JSON.stringify(land))
await shot('s2-yatay-odak.png')

// Temizlik: deneme profilindeki notlar
await evaluate(`(async () => { const { db } = await import('/src/db/index.ts'); await db.notebook.clear(); localStorage.setItem('yds-focus', '0'); return true })()`)
console.log(logs.length ? logs.join('\n') : 'konsol hatası yok')
console.log(fail ? `${fail} HATA` : 'HEPSİ TAMAM')
ws.close()
proc.kill()
process.exit(fail ? 1 : 0)
