import type { CSSProperties, ReactNode } from 'react'
import {
  ACCENTS,
  FONT_OPTIONS,
  PRESETS,
  TONES,
  accentHex,
  hexToHueSat,
  isDefaultAppearance,
  useAppearance,
  type Appearance,
} from '../stores/appearance'
import { useTheme, type ThemeChoice } from '../stores/theme'
import styles from './AppearanceCard.module.css'

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '📱 Sistem' },
  { value: 'light', label: '☀️ Açık' },
  { value: 'dark', label: '🌙 Koyu' },
]
const SCALES = [
  { value: 90, label: 'Küçük' },
  { value: 100, label: 'Normal' },
  { value: 112.5, label: 'Büyük' },
  { value: 125, label: 'Çok büyük' },
]
const RADII = [
  { value: 0.4, label: 'Keskin' },
  { value: 1, label: 'Normal' },
  { value: 1.5, label: 'Yuvarlak' },
]
// Zemin kutucuklarındaki örnek renk (açık tema)
const TONE_SWATCH: Record<string, (a: Appearance) => string> = {
  neutral: () => 'hsl(220 20% 95%)',
  accent: (a) => `hsl(${a.hue} 40% 92%)`,
  warm: () => 'hsl(36 50% 91%)',
  cool: () => 'hsl(208 45% 91%)',
  green: () => 'hsl(125 28% 90%)',
  paper: () => 'hsl(40 45% 88%)',
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.options}>{children}</div>
    </div>
  )
}

function Choice({ active, onClick, children, style }: { active: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button type="button" className={`${styles.choice} ${active ? styles.active : ''}`} aria-pressed={active} onClick={onClick} style={style}>
      {children}
    </button>
  )
}

/** Ayarlar › Görünüm: açık/koyu, hazır görünümler, vurgu rengi, zemin, yazı, köşeler, kontrast, hareket. */
export function AppearanceCard() {
  const theme = useTheme((s) => s.theme)
  const setTheme = useTheme((s) => s.setTheme)
  const a = useAppearance((s) => s.appearance)
  const update = useAppearance((s) => s.update)
  const reset = useAppearance((s) => s.reset)
  const custom = !ACCENTS.some((c) => c.hue === a.hue && c.sat === a.sat)

  return (
    <section className="card" id="gorunum">
      <div className={styles.head}>
        <h2 className={styles.title}>🎨 Görünüm</h2>
        {!isDefaultAppearance(a) && (
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Varsayılana dön
          </button>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Değişiklikler hemen uygulanır ve bu cihazda hatırlanır. “Sistem” seçiliyse telefonun açık/koyu ayarı izlenir.
      </p>

      <Row label="Tema">
        {THEME_OPTIONS.map((o) => (
          <Choice key={o.value} active={theme === o.value} onClick={() => setTheme(o.value)}>
            {o.label}
          </Choice>
        ))}
      </Row>

      <Row label="Hazır görünüm">
        {PRESETS.map((p) => {
          const active = (Object.keys(p.set) as (keyof Appearance)[]).every((k) => a[k] === p.set[k])
          return (
            <Choice key={p.name} active={active} onClick={() => update(p.set)}>
              <span className={styles.dot} style={{ background: accentHex(p.set.hue ?? a.hue, p.set.sat ?? a.sat) }} />
              {p.name}
            </Choice>
          )
        })}
      </Row>

      <Row label="Vurgu rengi">
        {ACCENTS.map((c) => (
          <button
            key={c.name}
            type="button"
            className={`${styles.swatch} ${a.hue === c.hue && a.sat === c.sat ? styles.swatchActive : ''}`}
            style={{ background: accentHex(c.hue, c.sat) }}
            title={c.name}
            aria-label={c.name}
            aria-pressed={a.hue === c.hue && a.sat === c.sat}
            onClick={() => update({ hue: c.hue, sat: c.sat })}
          />
        ))}
        <label className={`${styles.swatch} ${styles.custom} ${custom ? styles.swatchActive : ''}`} title="Özel renk">
          <span aria-hidden="true">＋</span>
          <input
            type="color"
            aria-label="Özel vurgu rengi"
            value={accentHex(a.hue, a.sat)}
            onChange={(e) => update(hexToHueSat(e.target.value))}
          />
        </label>
      </Row>

      <Row label="Zemin tonu">
        {TONES.map((t) => (
          <Choice key={t.value} active={a.tone === t.value} onClick={() => update({ tone: t.value })}>
            <span className={styles.dot} style={{ background: TONE_SWATCH[t.value](a), border: '1px solid var(--border)' }} />
            {t.label}
          </Choice>
        ))}
      </Row>
      <label className={styles.check}>
        <input type="checkbox" checked={a.black} onChange={(e) => update({ black: e.target.checked })} />
        Koyu temada tam siyah zemin (OLED ekranda pil dostu)
      </label>

      <Row label="Yazı boyutu">
        {SCALES.map((s) => (
          <Choice key={s.value} active={a.scale === s.value} onClick={() => update({ scale: s.value })} style={{ fontSize: `${s.value * 0.0085}rem` }}>
            {s.label}
          </Choice>
        ))}
      </Row>

      <Row label="Yazı tipi">
        {FONT_OPTIONS.map((f) => (
          <Choice key={f.value} active={a.font === f.value} onClick={() => update({ font: f.value })} style={{ fontFamily: f.family }}>
            {f.label}
          </Choice>
        ))}
      </Row>

      <Row label="Köşeler">
        {RADII.map((r) => (
          <Choice key={r.value} active={a.radius === r.value} onClick={() => update({ radius: r.value })} style={{ borderRadius: `${Math.round(10 * r.value)}px` }}>
            {r.label}
          </Choice>
        ))}
      </Row>

      <Row label="Kontrast">
        <Choice active={a.contrast === 'normal'} onClick={() => update({ contrast: 'normal' })}>
          Normal
        </Choice>
        <Choice active={a.contrast === 'high'} onClick={() => update({ contrast: 'high' })}>
          Yüksek
        </Choice>
      </Row>

      <Row label="Hareket">
        <Choice active={a.motion === 'normal'} onClick={() => update({ motion: 'normal' })}>
          Normal
        </Choice>
        <Choice active={a.motion === 'reduce'} onClick={() => update({ motion: 'reduce' })}>
          Azalt
        </Choice>
      </Row>

      <div className={styles.preview} aria-hidden="true">
        <span className="btn btn-primary">Örnek düğme</span>
        <span className={styles.chip}>Etiket</span>
        <span className="muted">soluk metin</span>
        <span className={styles.bar}>
          <span />
        </span>
      </div>
    </section>
  )
}
