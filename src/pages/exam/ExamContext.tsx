import { useEffect, useState } from 'react'
import { sectionOf } from '../../services/ydsSections'
import styles from '../ExamStudy.module.css'
import { loadAllExams, shortTitle, type ExamBundle } from './examData'

// Kelimenin çıkmış YDS sorularında geçtiği cümleler. Yalnızca yerelde (dev) yüklenir;
// cümleler veritabanına kopyalanmaz, her seferinde yerel sınav dosyalarından okunur.

interface Hit {
  en: string
  tr?: string
  where: string
}

interface Segment {
  en: string
  tr?: string
  where: string
}

let segmentsPromise: Promise<Segment[]> | null = null
const cache = new Map<string, { count: number; hits: Hit[] }>()

function allSegments(): Promise<Segment[]> {
  segmentsPromise ??= loadAllExams().then((bundles: ExamBundle[]) => {
    const out: Segment[] = []
    for (const { exam, tr } of bundles) {
      const title = shortTitle(exam.title)
      const passageQ = new Map<string, number>()
      for (const q of exam.questions) if (q.passage && !passageQ.has(q.passage)) passageQ.set(q.passage, q.no)
      for (const p of exam.passages) {
        const no = passageQ.get(p.id)
        const where = `${title} · ${p.kind === 'cloze' ? 'Cloze' : 'Okuma'} paragrafı${no ? ` (Soru ${no}…)` : ''}`
        for (const s of p.sentences) out.push({ en: s.en, tr: tr[s.id], where })
      }
      for (const q of exam.questions) {
        const where = `${title} · Soru ${q.no} (${sectionOf(q.no, exam.id).label})`
        for (const s of q.stem) out.push({ en: s.en, tr: tr[s.id], where })
      }
    }
    return out
  }).catch((e) => {
    segmentsPromise = null
    throw e
  })
  return segmentsPromise
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Kelime ve basit çekimleri (s, es, ed, d, ing, ly) için eşleştirici. */
function termRegex(term: string): RegExp {
  const t = term.trim().toLowerCase()
  if (/\s/.test(t)) return new RegExp(`\\b${t.split(/\s+/).map(escapeRe).join('\\s+')}`, 'i')
  const stem = t.endsWith('e') ? t.slice(0, -1) : t
  return new RegExp(`\\b(?:${escapeRe(t)}(?:s|es|ed|d|ing|ly)?|${escapeRe(stem)}(?:ing|ed))\\b`, 'i')
}

function Highlight({ text, re }: { text: string; re: RegExp }) {
  const m = re.exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      {text.slice(0, m.index)}
      <mark className={styles.ctxMark}>{m[0]}</mark>
      {text.slice(m.index + m[0].length)}
    </>
  )
}

/** Kart arka yüzünde: "Çıkmış sorularda N kez geçti" + örnek cümleler (açılır). */
export default function ExamContext({ term }: { term: string }) {
  const key = term.trim().toLowerCase()
  const [data, setData] = useState(() => cache.get(key) ?? null)

  useEffect(() => {
    // Kelime değişince bileşen yeniden kurulur (Study'de key={term}); önbellekteyse ilk değer yeterli
    if (!key || cache.has(key)) return
    let alive = true
    allSegments()
      .then((segs) => {
        const re = termRegex(key)
        const matches = segs.filter((s) => re.test(s.en))
        // Çevirisi olan ve kısa cümleler önce
        const hits = [...matches]
          .sort((a, b) => Number(Boolean(b.tr)) - Number(Boolean(a.tr)) || a.en.length - b.en.length)
          .slice(0, 3)
        const res = { count: matches.length, hits }
        cache.set(key, res)
        if (alive) setData(res)
      })
      .catch(() => {
        // Yerel veri yoksa sessizce gizlen
      })
    return () => {
      alive = false
    }
  }, [key])

  if (!data || data.count === 0) return null
  const re = termRegex(key)
  return (
    <details className={styles.ctxBox}>
      <summary>
        📚 Çıkmış YDS sorularında <strong>{data.count}</strong> kez geçti — örnekleri gör
      </summary>
      <ul className={styles.ctxList}>
        {data.hits.map((h, i) => (
          <li key={i}>
            <p className={styles.ctxEn}>
              <Highlight text={h.en} re={re} />
            </p>
            {h.tr && <p className={styles.ctxTr}>{h.tr}</p>}
            <small className={styles.ctxWhere}>{h.where}</small>
          </li>
        ))}
      </ul>
    </details>
  )
}
