import { DUS_SUBJECTS, listDusExams, loadDusGlossary, subjectOf, type DusTestKey } from './dus'

// DUS kavramları: soru terim sözlüklerindeki (local-data/dus/sozluk) terimler tekilleştirilir.
// Kavram sözlüğü (liste) ve Terim kartları (ders → 20'lik seviyeler) aynı veriyi kullanır.

export interface Concept {
  /** Küçük harfli anahtar (tekilleştirme ve ilerleme kaydı) */
  key: string
  terim: string
  kisa: string
  aciklama: string
  koken?: string
  /** Geçtiği dersler (kimlik) */
  subjects: Set<string>
  /** En çok geçtiği ders: terim kartlarında bu dersin altında durur */
  main: string
  /** Kaç soruda geçti */
  count: number
}

export const trLower = (s: string) => s.toLocaleLowerCase('tr')

let cache: Promise<Concept[]> | null = null

export function loadConcepts(): Promise<Concept[]> {
  cache ??= build()
  return cache
}

async function build(): Promise<Concept[]> {
  const exams = await listDusExams()
  const all = await Promise.all(exams.map((e) => loadDusGlossary(e.id)))
  const map = new Map<string, Concept>()
  const perSubject = new Map<string, Map<string, number>>()
  for (const gloss of all) {
    for (const [qKey, g] of Object.entries(gloss)) {
      const [test, n] = qKey.split('/')
      const subject = subjectOf(test as DusTestKey, Number(n))?.id
      for (const t of g.terimler ?? []) {
        const name = (t.terim || t.metin || '').trim()
        if (!name) continue
        const key = trLower(name)
        let c = map.get(key)
        if (!c) {
          c = { key, terim: name, kisa: t.kisa, aciklama: t.aciklama, koken: t.koken, subjects: new Set(), main: '', count: 0 }
          map.set(key, c)
          perSubject.set(key, new Map())
        }
        // En dolu açıklama kalsın (aynı terim farklı sorularda farklı uzunlukta açıklanmış olabilir)
        if ((t.aciklama?.length ?? 0) > (c.aciklama?.length ?? 0)) c.aciklama = t.aciklama
        if (!c.koken && t.koken) c.koken = t.koken
        if (subject) {
          c.subjects.add(subject)
          const m = perSubject.get(key)!
          m.set(subject, (m.get(subject) ?? 0) + 1)
        }
        c.count++
      }
    }
  }
  const order = new Map(DUS_SUBJECTS.map((s, i) => [s.id, i]))
  for (const c of map.values()) {
    // Eşitlikte ders sırası (önce temel bilimler) belirler: sonuç her açılışta aynı kalır
    c.main =
      [...perSubject.get(c.key)!.entries()].sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))[0]?.[0] ?? ''
  }
  return [...map.values()].sort((a, b) => a.terim.localeCompare(b.terim, 'tr'))
}

/** Bir seviyedeki terim sayısı (YDS kelime kartlarındaki 20'lik gruplarla aynı). */
export const TERM_LEVEL_SIZE = 20

/** Dersin terimleri: en sık sorulan önce; 20'lik seviyelere bu sırayla bölünür. */
export function termsOfSubject(all: Concept[], subjectId: string): Concept[] {
  return all.filter((c) => c.main === subjectId).sort((a, b) => b.count - a.count || a.terim.localeCompare(b.terim, 'tr'))
}

export function levelsOf<T>(terms: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < terms.length; i += TERM_LEVEL_SIZE) out.push(terms.slice(i, i + TERM_LEVEL_SIZE))
  return out
}

// İlerleme: terim → son verilen puan (1–5). Yalnızca bu cihazda (yds-dus-terim:<kullanıcı>).
export type TermScores = Record<string, number>

const scoreKey = (userId: string) => `yds-dus-terim:${userId}`

export function readTermScores(userId: string): TermScores {
  try {
    const v = JSON.parse(localStorage.getItem(scoreKey(userId)) || '{}') as unknown
    return v && typeof v === 'object' ? (v as TermScores) : {}
  } catch {
    return {}
  }
}

export function saveTermScore(userId: string, key: string, score: number): TermScores {
  const next = { ...readTermScores(userId), [key]: score }
  try {
    localStorage.setItem(scoreKey(userId), JSON.stringify(next))
  } catch {
    // depo dolu/kapalı: puan yalnızca bu oturumda kalır
  }
  return next
}

/** 4 ve 5 "öğrendim" sayılır (YDS kartlarındaki Öğrendim düğmesi 4 verir). */
export const isLearned = (score: number | undefined) => (score ?? 0) >= 4

export function levelSummary(level: Concept[], scores: TermScores) {
  let done = 0
  let learned = 0
  for (const c of level) {
    const s = scores[c.key]
    if (s) done++
    if (isLearned(s)) learned++
  }
  return { done, learned, total: level.length, percent: level.length ? Math.round((learned / level.length) * 100) : 0 }
}
