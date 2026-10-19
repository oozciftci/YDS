import { OZGUN_FILES, type OzgunFile, type OzgunQ, type OzgunSet } from '../../data/ozgunTypes'
import { rangeIn, type SectionKey } from '../../services/ydsSections'
import type { ExamBundle, Passage, Question, Seg } from './examData'

// Özgün alıştırma setlerini yükler ve çıkmış soru kartının (QuestionCard) okuduğu ExamBundle biçimine çevirir.

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const ROMAN = ['I', 'II', 'III', 'IV', 'V']

export interface OzgunSetMeta {
  id: string
  type: SectionKey
  title: string
  count: number
}

let cache: Promise<{ files: OzgunFile[] }> | null = null

async function loadFiles(): Promise<{ files: OzgunFile[] }> {
  cache ??= Promise.all(
    OZGUN_FILES.map(async ({ file }) => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}data/ozgun/${file}.json`)
        return r.ok ? ((await r.json()) as OzgunFile) : null
      } catch {
        return null
      }
    }),
  ).then((all) => ({ files: all.filter((f): f is OzgunFile => f !== null) }))
  return cache
}

export async function listOzgunSets(): Promise<OzgunSetMeta[]> {
  const { files } = await loadFiles()
  return files.flatMap((f) => f.sets.map((s) => ({ id: s.id, type: f.type, title: s.title, count: s.qs.length })))
}

function asArray(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

/** Bir seti, QuestionCard’ın beklediği sınav paketine çevirir. Soru numaraları tipin ÖSYM aralığından başlar. */
export function toBundle(set: OzgunSet, type: SectionKey): ExamBundle {
  const start = rangeIn(type, 'yds')?.[0] ?? 1
  const tr: Record<string, string> = {}
  const passages: Passage[] = []
  let passageId: string | null = null

  if (set.passage) {
    passageId = 'p1'
    const sentences: Seg[] = set.passage.sentences.map((raw, i) => {
      const en = raw.replace(/\[\[(\d+)\]\]/g, (_m, n: string) => `(${start + Number(n) - 1})----`)
      const id = `p1.${i + 1}`
      const t = set.passage?.tr?.[i]
      if (t) tr[id] = t.replace(/\[\[(\d+)\]\]/g, (_m, n: string) => `(${start + Number(n) - 1})----`)
      return { id, en }
    })
    passages.push({ id: 'p1', kind: set.passage.kind, text: sentences.map((s) => s.en).join(' '), sentences })
  }

  const questions: Question[] = set.qs.map((q: OzgunQ, i) => {
    const no = start + i
    const qid = `q${no}`
    const stemLines = asArray(q.s)
    const stemTr = asArray(q.t)
    const stem: Seg[] = stemLines.map((en, j) => {
      const id = `${qid}.s${j + 1}`
      if (stemTr[j]) tr[id] = stemTr[j]
      return { id, en: type === 'irrelevant' ? `(${ROMAN[j]}) ${en}` : en }
    })
    const opts = q.o.length ? q.o : ROMAN
    const options: Record<string, Seg> = {}
    opts.forEach((en, j) => {
      const id = `${qid}.${LETTERS[j]}`
      options[LETTERS[j]] = { id, en }
      if (q.ot?.[j]) tr[id] = q.ot[j]
    })
    return { no, passage: passageId, stem, options, answer: LETTERS[q.a] ?? null }
  })

  return { exam: { id: `ozgun-${set.id}`, title: set.title, passages, questions }, tr }
}

export async function loadOzgunSet(id: string): Promise<{ bundle: ExamBundle; set: OzgunSet; type: SectionKey } | null> {
  const { files } = await loadFiles()
  for (const f of files) {
    const set = f.sets.find((s) => s.id === id)
    if (set) return { bundle: toBundle(set, f.type), set, type: f.type }
  }
  return null
}
