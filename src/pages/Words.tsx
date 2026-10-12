import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BulkImportModal } from '../components/BulkImportModal'
import { WordCard } from '../components/WordCard'
import { WordModal } from '../components/WordModal'
import { WordTable } from '../components/WordTable'
import {
  bulkCreateWords,
  createWord,
  deleteWord,
  updateWord,
  type CreateWordInput,
} from '../services/words'
import { useUserStore } from '../stores/user'
import type { WordItem } from '../types/database'
import styles from './Words.module.css'

const SAMPLE_YDS_WORDS: CreateWordInput[] = [
  {
    term: 'deteriorate',
    definition: 'kötüleşmek, bozulmak, fenalaşmak',
    partOfSpeech: 'verb',
    synonyms: ['worsen', 'decline', 'degenerate', 'decay'],
    antonyms: ['improve', 'recover'],
    collocations: ['deteriorate rapidly', 'relations deteriorate'],
    sentences: [{ en: "The patient's condition deteriorated overnight.", tr: 'Hastanın durumu bir gecede kötüleşti.' }],
    tags: ['YDS', 'Sağlık'],
    difficulty: 2,
  },
  {
    term: 'abolish',
    definition: 'yürürlükten kaldırmak, feshetmek',
    partOfSpeech: 'verb',
    synonyms: ['terminate', 'eliminate', 'revoke', 'annul'],
    antonyms: ['establish', 'enact'],
    collocations: ['abolish slavery', 'abolish taxes'],
    sentences: [{ en: 'The government decided to abolish the outdated law.', tr: 'Hükümet eski yasayı yürürlükten kaldırmaya karar verdi.' }],
    tags: ['YDS', 'Hukuk', 'Tarih'],
    difficulty: 2,
  },
  {
    term: 'enhance',
    definition: 'artırmak, geliştirmek, yükseltmek',
    partOfSpeech: 'verb',
    synonyms: ['improve', 'boost', 'augment', 'strengthen'],
    antonyms: ['diminish', 'impair'],
    collocations: ['enhance performance', 'enhance quality'],
    sentences: [{ en: 'Regular exercise can enhance cognitive functions.', tr: 'Düzenli egzersiz bilişsel işlevleri geliştirebilir.' }],
    tags: ['YDS', 'Eğitim', 'Bilim'],
    difficulty: 1,
  },
  {
    term: 'refrain from',
    definition: '-den kaçınmak, kendini sakınmak',
    partOfSpeech: 'phrasal_verb',
    synonyms: ['abstain from', 'avoid', 'hold back from'],
    antonyms: ['indulge in'],
    collocations: ['refrain from smoking', 'refrain from comment'],
    sentences: [{ en: 'Please refrain from using mobile phones during the exam.', tr: 'Lütfen sınav sırasında cep telefonu kullanmaktan kaçının.' }],
    tags: ['YDS', 'Kalıplar'],
    difficulty: 2,
  },
  {
    term: 'abrupt',
    definition: 'ani, beklenmedik, sert',
    partOfSpeech: 'adjective',
    synonyms: ['sudden', 'unexpected', 'sharp', 'precipitous'],
    antonyms: ['gradual'],
    collocations: ['abrupt change', 'abrupt departure'],
    sentences: [{ en: 'There was an abrupt change in the weather.', tr: 'Havada ani bir değişiklik oldu.' }],
    tags: ['YDS'],
    difficulty: 2,
  },
]

export function WordsPage() {
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_osman'

  // Canlı Kelime Listesi
  const rawWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  // Filtre State'leri
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPos, setSelectedPos] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedDiff, setSelectedDiff] = useState<string>('all')

  // Görünüm Modu ('cards' | 'table')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('yds.words_view_mode') as 'cards' | 'table') || 'cards'
  })

  // Modal State'leri
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordItem | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  function toggleViewMode(mode: 'cards' | 'table') {
    setViewMode(mode)
    localStorage.setItem('yds.words_view_mode', mode)
  }

  // Kullanıcının mevcut tüm etiketleri
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const w of rawWords) {
      if (w.tags) {
        for (const t of w.tags) set.add(t)
      }
    }
    return Array.from(set).sort()
  }, [rawWords])

  // Filtrelenmiş ve Sıralanmış Kelimeler
  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return rawWords
      .filter((w) => {
        // Arama (terim, anlam, eş anlamlılar, etiketler)
        if (q) {
          const matchTerm = w.term.toLowerCase().includes(q)
          const matchDef = w.definition.toLowerCase().includes(q)
          const matchSyn = w.synonyms?.some((s) => s.toLowerCase().includes(q))
          const matchTags = w.tags?.some((t) => t.toLowerCase().includes(q))
          if (!matchTerm && !matchDef && !matchSyn && !matchTags) return false
        }

        // Tür filtresi
        if (selectedPos !== 'all' && w.partOfSpeech !== selectedPos) {
          return false
        }

        // Etiket filtresi
        if (selectedTag !== 'all' && !w.tags?.includes(selectedTag)) {
          return false
        }

        // Zorluk filtresi
        if (selectedDiff !== 'all' && String(w.difficulty) !== selectedDiff) {
          return false
        }

        return true
      })
      .sort((a, b) => a.term.localeCompare(b.term, 'en'))
  }, [rawWords, searchQuery, selectedPos, selectedTag, selectedDiff])

  // CRUD İşlemleri
  async function handleSaveWord(data: CreateWordInput) {
    if (editingWord) {
      await updateWord(editingWord.id, activeUserId, data)
      setEditingWord(null)
    } else {
      await createWord(activeUserId, data)
    }
  }

  async function handleDeleteWord(wordId: string) {
    await deleteWord(wordId, activeUserId)
  }

  async function handleBulkImport(items: CreateWordInput[]) {
    return await bulkCreateWords(activeUserId, items)
  }

  async function handleLoadSampleWords() {
    await bulkCreateWords(activeUserId, SAMPLE_YDS_WORDS)
  }

  return (
    <section className={styles.container}>
      {/* Üst Başlık ve İşlem Butonları */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Kelimeler</h1>
          <p className="muted">
            {activeUser?.displayName || 'Kullanıcı'} için kelime havuzu ({rawWords.length} kayıtlı kelime)
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            id="btn-add-word"
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            + Kelime Ekle
          </button>
          <button
            id="btn-bulk-import"
            type="button"
            className="btn"
            onClick={() => setIsBulkModalOpen(true)}
          >
            📥 Toplu İçe Aktar
          </button>
        </div>
      </header>

      {/* Arama ve Filtreleme Araç Çubuğu */}
      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <input
            id="words-search"
            type="search"
            className={`input ${styles.searchInput}`}
            placeholder="Kelime, anlam, eş anlamlı veya etiket ara…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Görünüm Değiştirici: Kartlar / Tablo */}
          <div className={styles.viewToggle} role="group" aria-label="Görünüm modu">
            <button
              type="button"
              id="view-cards-btn"
              className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
              onClick={() => toggleViewMode('cards')}
              title="Kart Görünümü"
            >
              <span>🗂️</span> Kartlar
            </button>
            <button
              type="button"
              id="view-table-btn"
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => toggleViewMode('table')}
              title="Tablo Görünümü"
            >
              <span>📋</span> Tablo
            </button>
          </div>
        </div>

        <div className={styles.filterRow}>
          {/* Tür Filtresi */}
          <select
            className={styles.filterSelect}
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            aria-label="Kelime türü filtresi"
          >
            <option value="all">Tüm Türler</option>
            <option value="verb">Fiiller</option>
            <option value="noun">İsimler</option>
            <option value="adjective">Sıfatlar</option>
            <option value="adverb">Zarflar</option>
            <option value="phrasal_verb">Phrasal Verbler</option>
            <option value="conjunction">Bağlaçlar</option>
            <option value="preposition">Edatlar</option>
            <option value="idiom">Deyimler</option>
          </select>

          {/* Zorluk Filtresi */}
          <select
            className={styles.filterSelect}
            value={selectedDiff}
            onChange={(e) => setSelectedDiff(e.target.value)}
            aria-label="Zorluk seviyesi filtresi"
          >
            <option value="all">Tüm Zorluklar</option>
            <option value="1">1 - Temel</option>
            <option value="2">2 - Orta (YDS)</option>
            <option value="3">3 - İleri</option>
          </select>

          {/* Etiket Filtresi */}
          {allTags.length > 0 && (
            <select
              className={styles.filterSelect}
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              aria-label="Etiket filtresi"
            >
              <option value="all">Tüm Etiketler</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}

          <span className={styles.resultsCount}>
            {filteredWords.length} kelime gösteriliyor
          </span>
        </div>
      </div>

      {/* Liste / Kart İçeriği */}
      {rawWords.length === 0 ? (
        <div className={`card ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>📖</div>
          <h2>Henüz kelime eklemediniz</h2>
          <p className="muted" style={{ maxWidth: '420px' }}>
            YDS çalışmalarınıza başlamak için tek tek kelime ekleyebilir, hazır listenizi toplu yükleyebilir veya örnek kelimeleri yükleyebilirsiniz.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              + İlk Kelimeni Ekle
            </button>
            <button type="button" className="btn" onClick={() => setIsBulkModalOpen(true)}>
              📥 Toplu İçe Aktar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void handleLoadSampleWords()}>
              ✨ 5 Örnek YDS Kelimesi Yükle
            </button>
          </div>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className={`card ${styles.emptyState}`}>
          <h3>Filtreye uygun kelime bulunamadı</h3>
          <p className="muted">Farklı bir arama terimi veya filtre seçmeyi deneyin.</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearchQuery('')
              setSelectedPos('all')
              setSelectedTag('all')
              setSelectedDiff('all')
            }}
          >
            Filtreleri Sıfırla
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className={styles.cardsGrid}>
          {filteredWords.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              onEdit={(w) => setEditingWord(w)}
              onDelete={(id) => void handleDeleteWord(id)}
            />
          ))}
        </div>
      ) : (
        <WordTable
          words={filteredWords}
          onEdit={(w) => setEditingWord(w)}
          onDelete={(id) => void handleDeleteWord(id)}
        />
      )}

      {/* Tekil Kelime Ekleme / Düzenleme Modalı */}
      {(isAddModalOpen || editingWord) && (
        <WordModal
          initialWord={editingWord}
          onClose={() => {
            setIsAddModalOpen(false)
            setEditingWord(null)
          }}
          onSave={handleSaveWord}
        />
      )}

      {/* Toplu İçe Aktarma Modalı */}
      {isBulkModalOpen && (
        <BulkImportModal
          onClose={() => setIsBulkModalOpen(false)}
          onImport={handleBulkImport}
        />
      )}
    </section>
  )
}
