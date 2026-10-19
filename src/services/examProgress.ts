import { db } from '../db'
import type { ExamAnswer } from '../types/database'
import { YDS_SECTIONS, sectionOf, type SectionKey } from './ydsSections'

// Çıkmış YDS sorularına verilen cevapların kaydı (Dexie). Soru metni tutulmaz.

export function answerId(userId: string, examId: string, no: number): string {
  return `${userId}_${examId}_${no}`
}

/**
 * Bir sorunun cevabını kaydeder. `fromWrongBook` true ise ve cevap doğruysa soru Yanlış Defteri'nden çıkar;
 * normal çalışmada doğru cevap defterdeki soruyu çıkarmaz (önce defterde doğru çözülmeli).
 */
export async function recordAnswer(
  userId: string,
  examId: string,
  no: number,
  choice: string,
  correct: boolean,
  opts: { fromWrongBook?: boolean } = {},
): Promise<ExamAnswer> {
  const id = answerId(userId, examId, no)
  const now = new Date().toISOString()
  const prev = await db.examAnswers.get(id)
  const next: ExamAnswer = {
    id,
    userId,
    examId,
    no,
    section: sectionOf(no).key,
    choice,
    correct,
    attempts: (prev?.attempts ?? 0) + 1,
    wrongCount: (prev?.wrongCount ?? 0) + (correct ? 0 : 1),
    inWrongBook: correct ? Boolean(prev?.inWrongBook) && !opts.fromWrongBook : true,
    firstAnsweredAt: prev?.firstAnsweredAt ?? now,
    answeredAt: now,
  }
  await db.examAnswers.put(next)
  return next
}

/** Soruyu Yanlış Defteri'nden elle çıkarır. */
export async function removeFromWrongBook(id: string): Promise<void> {
  await db.examAnswers.update(id, { inWrongBook: false })
}

/** Bir sınavın kayıtlarını siler (sınavı baştan çözmek için). */
export async function resetExamAnswers(userId: string, examId: string): Promise<void> {
  await db.examAnswers.where('[userId+examId]').equals([userId, examId]).delete()
}

export interface SectionStat {
  key: SectionKey
  answered: number
  correct: number
  /** 0-100; hiç cevap yoksa null */
  percent: number | null
}

/** Son cevaplara göre tip bazlı başarı. */
export function summarizeBySection(answers: ExamAnswer[]): SectionStat[] {
  return YDS_SECTIONS.map((s) => {
    const list = answers.filter((a) => a.section === s.key)
    const correct = list.filter((a) => a.correct).length
    return {
      key: s.key,
      answered: list.length,
      correct,
      percent: list.length ? Math.round((correct / list.length) * 100) : null,
    }
  })
}

const LEGACY_PREFIX = 'yds-exam-progress:'
const LEGACY_FLAG = 'yds-exam-progress-migrated-v1'

/**
 * Eski sürüm cevapları tarayıcı deposunda (`yds-exam-progress:<sınav>`) tutuyordu.
 * Bir kez, o anki kullanıcıya veritabanına taşır; eski anahtarlar silinmez (geri dönüş için).
 */
export async function migrateLegacyExamProgress(userId: string): Promise<number> {
  let migrated = 0
  try {
    if (localStorage.getItem(LEGACY_FLAG)) return 0
    const rows: ExamAnswer[] = []
    const now = new Date().toISOString()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LEGACY_PREFIX)) continue
      const examId = key.slice(LEGACY_PREFIX.length)
      const data = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, { choice: string; correct: boolean }>
      for (const [noStr, p] of Object.entries(data)) {
        const no = Number(noStr)
        if (!no || !p?.choice) continue
        rows.push({
          id: answerId(userId, examId, no),
          userId,
          examId,
          no,
          section: sectionOf(no).key,
          choice: p.choice,
          correct: Boolean(p.correct),
          attempts: 1,
          wrongCount: p.correct ? 0 : 1,
          inWrongBook: !p.correct,
          firstAnsweredAt: now,
          answeredAt: now,
        })
      }
    }
    if (rows.length) {
      // Veritabanında zaten kayıt varsa üzerine yazma
      const existing = new Set((await db.examAnswers.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((r) => r!.id))
      const fresh = rows.filter((r) => !existing.has(r.id))
      await db.examAnswers.bulkPut(fresh)
      migrated = fresh.length
    }
    localStorage.setItem(LEGACY_FLAG, new Date().toISOString())
  } catch {
    // Tarayıcı deposu kapalıysa taşınacak bir şey de yoktur
  }
  return migrated
}
