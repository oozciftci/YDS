import { create } from 'zustand'
import { syncThemeColor } from './theme'

// Görünüm tercihleri (Ayarlar › Görünüm): vurgu rengi, zemin tonu, yazı boyutu/tipi, köşeler, kontrast, hareket.
// index.css'teki tasarım değişkenlerinin üzerine <style id="yds-appearance"> ile yazılır; açık ve koyu tema için
// ayrı değerler üretilir (data-theme ve sistem ayarı aynı seçicilerle). Varsayılanlar index.css'in kendisidir:
// her şey varsayılandaysa hiçbir şey yazılmaz. Tercih cihaza özeldir (tarayıcı deposu).

export type Tone = 'neutral' | 'accent' | 'warm' | 'cool' | 'green' | 'paper'
export type FontChoice = 'inter' | 'system' | 'serif' | 'readable'

export interface Appearance {
  /** Vurgu rengi: ton (0-360) ve doygunluk (%) */
  hue: number
  sat: number
  /** Başlık renkleri: 'text' (yazı rengi), 'accent' (vurgu rengi) ya da 'ton,doygunluk' (ör. '355,70') */
  heading: string
  subheading: string
  tone: Tone
  /** Koyu temada tam siyah zemin (OLED ekranlarda pil dostu) */
  black: boolean
  /** Yazı boyutu (%) — tüm ölçüler rem olduğu için arayüz birlikte büyür */
  scale: number
  font: FontChoice
  /** Köşe yuvarlaklığı çarpanı */
  radius: number
  contrast: 'normal' | 'high'
  motion: 'normal' | 'reduce'
}

export const DEFAULT_APPEARANCE: Appearance = {
  hue: 221,
  sat: 70,
  heading: 'text',
  subheading: 'text',
  tone: 'neutral',
  black: false,
  scale: 100,
  font: 'inter',
  radius: 1,
  contrast: 'normal',
  motion: 'normal',
}

export const ACCENTS: { name: string; hue: number; sat: number }[] = [
  { name: 'Mavi', hue: 221, sat: 70 },
  { name: 'Çivit', hue: 243, sat: 62 },
  { name: 'Mor', hue: 268, sat: 58 },
  { name: 'Pembe', hue: 330, sat: 68 },
  { name: 'Kırmızı', hue: 355, sat: 70 },
  { name: 'Turuncu', hue: 22, sat: 85 },
  { name: 'Kehribar', hue: 40, sat: 90 },
  { name: 'Yeşil', hue: 148, sat: 60 },
  { name: 'Turkuaz', hue: 174, sat: 65 },
  { name: 'Gök', hue: 197, sat: 80 },
]

export const TONES: { value: Tone; label: string }[] = [
  { value: 'neutral', label: 'Nötr' },
  { value: 'accent', label: 'Vurgu renginde' },
  { value: 'warm', label: 'Sıcak' },
  { value: 'cool', label: 'Soğuk' },
  { value: 'green', label: 'Yeşilimsi' },
  { value: 'paper', label: 'Kâğıt' },
]

/** Hazır görünümler: tek dokunuşla renk + zemin (diğer tercihler korunur) */
export const PRESETS: { name: string; set: Partial<Appearance> }[] = [
  { name: 'Varsayılan', set: { hue: 221, sat: 70, tone: 'neutral', black: false } },
  { name: 'Okyanus', set: { hue: 197, sat: 80, tone: 'cool', black: false } },
  { name: 'Orman', set: { hue: 148, sat: 60, tone: 'green', black: false } },
  { name: 'Gün batımı', set: { hue: 22, sat: 85, tone: 'warm', black: false } },
  { name: 'Lavanta', set: { hue: 268, sat: 58, tone: 'accent', black: false } },
  { name: 'Kitap', set: { hue: 25, sat: 55, tone: 'paper', black: false } },
  { name: 'Gece', set: { hue: 174, sat: 65, tone: 'neutral', black: true } },
]

const KEY = 'yds-appearance'

function read(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Appearance>) }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

/** #rrggbb → ton/doygunluk (açıklık uygulamada okunurluk için ayrıca belirlenir) */
export function hexToHueSat(hex: string): { hue: number; sat: number } {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return { hue: 0, sat: 0 }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = Math.round(h * 60)
  return { hue: (h + 360) % 360, sat: Math.round(Math.min(1, s) * 100) }
}

/** Seçilen tonun ekranda görünen örneği (renk seçici ve kutucuklar için) */
export function accentHex(hue: number, sat: number): string {
  const s = sat / 100
  const l = lightL(hue) / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// Açık temada beyaz yazı okunsun diye sarı-yeşil-camgöbeği aralığı daha koyu
const lightL = (h: number) => (h >= 30 && h < 200 ? 34 : h >= 200 && h < 250 ? 50 : 47)

interface Palette {
  light: Record<string, string>
  dark: Record<string, string>
}

function palette(a: Appearance): Palette {
  const H = a.hue
  const S = Math.max(15, Math.min(90, a.sat))
  const L = lightL(H)
  const DS = Math.min(S, 70)
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}

  if (H !== DEFAULT_APPEARANCE.hue || a.sat !== DEFAULT_APPEARANCE.sat) {
    Object.assign(light, {
      '--primary': `hsl(${H} ${S}% ${L}%)`,
      '--primary-hover': `hsl(${H} ${S}% ${L - 6}%)`,
      '--primary-subtle': `hsl(${H} ${S}% ${L}% / 0.1)`,
      '--primary-glow': `hsl(${H} ${S}% ${L}% / 0.18)`,
      '--border-focus': `hsl(${H} ${S}% ${L}%)`,
      '--gradient-brand': `linear-gradient(135deg, hsl(${H} ${S}% ${L}%) 0%, hsl(${(H + 351) % 360} ${S}% ${L - 2}%) 100%)`,
    })
    Object.assign(dark, {
      '--primary': `hsl(${H} ${DS}% 72%)`,
      '--primary-hover': `hsl(${H} ${DS}% 78%)`,
      '--primary-subtle': `hsl(${H} ${DS}% 72% / 0.12)`,
      '--primary-glow': `hsl(${H} ${DS}% 72% / 0.16)`,
      '--border-focus': `hsl(${H} ${DS}% 72%)`,
      '--gradient-brand': `linear-gradient(135deg, hsl(${H} ${DS}% 72%) 0%, hsl(${(H + 353) % 360} ${Math.max(DS - 10, 10)}% 70%) 100%)`,
    })
  }

  for (const [name, value] of [['--heading', a.heading], ['--subheading', a.subheading]] as const) {
    if (value === 'accent') {
      light[name] = 'var(--primary)'
      dark[name] = 'var(--primary)'
    } else if (value !== 'text') {
      const [h, s] = value.split(',').map(Number)
      if (Number.isFinite(h) && Number.isFinite(s)) {
        // Yazı olarak okunsun: açık temada biraz daha koyu, koyu temada açık
        light[name] = `hsl(${h} ${Math.min(90, s)}% ${lightL(h) - 4}%)`
        dark[name] = `hsl(${h} ${Math.min(75, s)}% 72%)`
      }
    }
  }

  // Zemin: [ton, açık temada doygunluk, koyu temada doygunluk]
  const tones: Record<Exclude<Tone, 'neutral' | 'paper'>, [number, number, number]> = {
    accent: [H, 32, 12],
    warm: [36, 38, 9],
    cool: [208, 34, 14],
    green: [125, 20, 9],
  }
  if (a.tone === 'paper') {
    Object.assign(light, {
      '--bg': 'hsl(40 42% 92%)',
      '--surface': 'hsl(42 55% 97%)',
      '--surface-strong': 'hsl(40 38% 89%)',
      '--surface-hover': 'hsl(40 34% 85%)',
      '--border': 'hsl(38 24% 78%)',
      '--border-subtle': 'hsl(38 26% 85%)',
      '--text': 'hsl(28 30% 14%)',
      '--text-muted': 'hsl(28 16% 36%)',
      '--text-subtle': 'hsl(28 12% 50%)',
      '--input-bg': 'hsl(42 55% 98%)',
    })
    Object.assign(dark, toneDark(32, 10))
    dark['--text'] = 'hsl(38 30% 86%)'
    dark['--text-muted'] = 'hsl(38 14% 66%)'
    dark['--text-subtle'] = 'hsl(38 8% 50%)'
  } else if (a.tone !== 'neutral') {
    const [t, ls, ds] = tones[a.tone]
    Object.assign(light, {
      '--bg': `hsl(${t} ${ls}% 96%)`,
      '--surface': `hsl(${t} ${Math.round(ls * 0.6)}% 99.5%)`,
      '--surface-strong': `hsl(${t} ${Math.round(ls * 0.9)}% 93%)`,
      '--surface-hover': `hsl(${t} ${Math.round(ls * 0.9)}% 90%)`,
      '--border': `hsl(${t} ${Math.round(ls * 0.6)}% 85%)`,
      '--border-subtle': `hsl(${t} ${Math.round(ls * 0.6)}% 91%)`,
      '--text': `hsl(${t} 25% 13%)`,
      '--text-muted': `hsl(${t} 10% 38%)`,
      '--text-subtle': `hsl(${t} 8% 54%)`,
    })
    Object.assign(dark, toneDark(t, ds))
  }
  if (a.black) {
    Object.assign(dark, {
      '--bg': 'hsl(0 0% 0%)',
      '--surface': 'hsl(0 0% 6%)',
      '--surface-strong': 'hsl(0 0% 10%)',
      '--surface-hover': 'hsl(0 0% 14%)',
      '--border': 'hsl(0 0% 18%)',
      '--border-subtle': 'hsl(0 0% 12%)',
      '--input-bg': 'hsl(0 0% 4%)',
    })
  }
  if (a.contrast === 'high') {
    Object.assign(light, {
      '--text': 'hsl(220 30% 6%)',
      '--text-muted': 'hsl(220 16% 24%)',
      '--text-subtle': 'hsl(220 12% 36%)',
      '--border': 'hsl(220 14% 66%)',
      '--border-subtle': 'hsl(220 14% 78%)',
    })
    Object.assign(dark, {
      '--text': 'hsl(0 0% 100%)',
      '--text-muted': 'hsl(0 0% 100% / 0.82)',
      '--text-subtle': 'hsl(0 0% 100% / 0.64)',
      '--border': 'hsl(0 0% 100% / 0.32)',
      '--border-subtle': 'hsl(0 0% 100% / 0.2)',
    })
  }
  return { light, dark }
}

function toneDark(t: number, s: number): Record<string, string> {
  return {
    '--bg': `hsl(${t} ${s}% 8%)`,
    '--surface': `hsl(${t} ${s}% 12%)`,
    '--surface-strong': `hsl(${t} ${s}% 16%)`,
    '--surface-hover': `hsl(${t} ${s}% 20%)`,
    '--border': `hsl(${t} ${s}% 22%)`,
    '--border-subtle': `hsl(${t} ${s}% 17%)`,
    '--input-bg': `hsl(${t} ${s}% 10%)`,
  }
}

const FONTS: Record<FontChoice, string | null> = {
  inter: null,
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif",
  readable: "Verdana, 'Trebuchet MS', Tahoma, sans-serif",
}
export const FONT_OPTIONS: { value: FontChoice; label: string; family: string }[] = [
  { value: 'inter', label: 'Inter', family: "'Inter Variable', sans-serif" },
  { value: 'system', label: 'Sistem', family: FONTS.system! },
  { value: 'serif', label: 'Tırnaklı', family: FONTS.serif! },
  { value: 'readable', label: 'Geniş', family: FONTS.readable! },
]

const block = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')

/** Tercihlerden üretilen CSS (her şey varsayılansa boş) */
export function appearanceCss(a: Appearance): string {
  const { light, dark } = palette(a)
  const common: Record<string, string> = {}
  const font = FONTS[a.font]
  if (font) common['--font-sans'] = font
  if (a.radius !== 1) {
    for (const [k, v] of [['--radius-xs', 6], ['--radius-sm', 10], ['--radius', 14], ['--radius-lg', 20]] as const) {
      common[k] = `${Math.round(v * a.radius)}px`
    }
  }
  const css: string[] = []
  if (Object.keys(common).length || Object.keys(light).length) css.push(`:root { ${block({ ...common, ...light })} }`)
  if (Object.keys(dark).length) {
    css.push(`:root[data-theme='dark'] { ${block(dark)} }`)
    css.push(`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${block(dark)} } }`)
  }
  if (a.scale !== 100) css.push(`html { font-size: ${a.scale}%; }`)
  if (a.motion === 'reduce') css.push('*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }')
  return css.join('\n')
}

export function applyAppearance(a: Appearance) {
  let el = document.getElementById('yds-appearance') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'yds-appearance'
    document.head.appendChild(el)
  }
  el.textContent = appearanceCss(a)
  syncThemeColor()
}

interface AppearanceState {
  appearance: Appearance
  update: (patch: Partial<Appearance>) => void
  reset: () => void
}

function save(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    // depo kapalıysa yalnızca bu oturumda geçerli
  }
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  appearance: read(),
  update: (patch) => {
    const appearance = { ...get().appearance, ...patch }
    save(appearance)
    applyAppearance(appearance)
    set({ appearance })
  },
  reset: () => {
    save(DEFAULT_APPEARANCE)
    applyAppearance(DEFAULT_APPEARANCE)
    set({ appearance: DEFAULT_APPEARANCE })
  },
}))

export function isDefaultAppearance(a: Appearance): boolean {
  return (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[]).every((k) => a[k] === DEFAULT_APPEARANCE[k])
}
