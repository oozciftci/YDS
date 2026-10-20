import { useState, useMemo, type ReactNode } from 'react'
import { speakWord } from '../services/tts'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db'
import { BulkImportModal } from '../components/BulkImportModal'
import { TransferWordsModal } from '../components/TransferWordsModal'
import { WordCard } from '../components/WordCard'
import { WordModal } from '../components/WordModal'
import { WordPacksModal } from '../components/WordPacksModal'
import { TextWordsModal } from '../components/TextWordsModal'
import { WordTable } from '../components/WordTable'
import { AssignGroupModal } from '../components/AssignGroupModal'
import { BUILT_IN_GROUPS } from '../services/groups'
import { copySingleWordToUser } from '../services/wordTransfer'
import {
  bulkCreateWords,
  createWord,
  deleteWord,
  updateWord,
  type CreateWordInput,
} from '../services/words'
import { useUserStore } from '../stores/user'
import { MASTERY_CONFIG, type CardState, type MasteryLevel, type WordItem } from '../types/database'
import styles from './Words.module.css'

const PAGE = 50
const NO_WORDS: WordItem[] = []

const POS_SHORT: Record<string, string> = {
  verb: 'fiil',
  noun: 'isim',
  adjective: 'sıfat',
  adverb: 'zarf',
  phrasal_verb: 'phrasal',
  conjunction: 'bağlaç',
  preposition: 'edat',
  idiom: 'deyim',
}

/** Tek satırlık kelime: tıklayınca ayrıntılı kart altında açılır. */
function WordRow({
  word,
  card,
  open,
  onToggle,
  children,
}: {
  word: WordItem
  card?: CardState
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <li className={`${styles.wordRow} ${open ? styles.wordRowOpen : ''}`}>
      <div className={styles.rowLine}>
        <button type="button" className={styles.rowMain} onClick={onToggle} aria-expanded={open}>
          <strong className={styles.rowTerm}>{word.term}</strong>
          <span className={styles.rowPos}>{POS_SHORT[word.partOfSpeech] ?? ''}</span>
          <span className={styles.rowDef}>{word.definition}</span>
        </button>
        {card && (
          <span className={styles.rowMastery} title={MASTERY_CONFIG[(card.masteryScore as MasteryLevel) || 1].label}>
            {MASTERY_CONFIG[(card.masteryScore as MasteryLevel) || 1].badge}
          </span>
        )}
        <button
          type="button"
          className={styles.rowSpeak}
          onClick={() => speakWord(word.term)}
          aria-label={`${word.term} kelimesini dinle`}
          title="Dinle"
        >
          🔊
        </button>
      </div>
      {open && <div className={styles.rowDetail}>{children}</div>}
    </li>
  )
}

export function WordsPage() {
  const { activeUser, allUsers } = useUserStore()
  const activeUserId = activeUser?.id || 'user_ozgur'

  // Canlı Kelime Listesi
  const loadedWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
  )
  const rawWords = loadedWords ?? NO_WORDS

  const allCardStates = useLiveQuery(
    () => db.cardStates.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const cardMap = useMemo(() => {
    return new Map(allCardStates.map((c) => [c.wordId, c]))
  }, [allCardStates])

  const customGroups = useLiveQuery(
    () => db.wordGroups.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // Filtre State'leri
  // Hızlı aramadan gelince (?q=kelime) arama kutusu dolu açılır
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')
  const [selectedPos, setSelectedPos] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedDiff, setSelectedDiff] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  // Görünüm: sade liste (satıra tıklayınca ayrıntı açılır) ya da tablo
  const [viewMode, setViewMode] = useState<'list' | 'table'>(() => {
    try {
      return localStorage.getItem('yds.words_view_mode') === 'table' ? 'table' : 'list'
    } catch {
      return 'list'
    }
  })
  // Binlerce kelime aynı anda çizilmesin: sayfa sayfa göster
  const [shown, setShown] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)

  // Modal State'leri
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordItem | null>(null)
  const [groupingWord, setGroupingWord] = useState<WordItem | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isPacksModalOpen, setIsPacksModalOpen] = useState(false)
  const [isTextWordsOpen, setIsTextWordsOpen] = useState(false)

  function toggleViewMode(mode: 'list' | 'table') {
    setViewMode(mode)
    try {
      localStorage.setItem('yds.words_view_mode', mode)
    } catch {
      // Depo kapalıysa yalnızca bu oturumda geçerli
    }
  }

  // Filtre değişince listeyi başa sar
  const filterKey = `${searchQuery}|${selectedPos}|${selectedTag}|${selectedDiff}|${selectedGroup}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setShown(PAGE)
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

        // Grup / Deste filtresi
        if (selectedGroup !== 'all') {
          const builtIn = BUILT_IN_GROUPS.find((g) => g.id === selectedGroup)
          if (builtIn) {
            const card = cardMap.get(w.id)
            if (!builtIn.matcher(w, card, new Date().toISOString())) return false
          } else {
            const custom = customGroups.find((g) => g.id === selectedGroup)
            if (custom) {
              const inGroup = (custom.wordIds && custom.wordIds.includes(w.id)) || (w.groupIds && w.groupIds.includes(custom.id))
              if (!inGroup) return false
            }
          }
        }

        return true
      })
      .sort((a, b) => a.term.localeCompare(b.term, 'en'))
  }, [rawWords, searchQuery, selectedPos, selectedTag, selectedDiff, selectedGroup, cardMap, customGroups])

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

  const otherUser = allUsers.find((u) => u.id !== activeUserId)

  async function handleTransferSingleWord(word: WordItem) {
    if (!otherUser) return
    const confirmed = window.confirm(
      `"${word.term}" kelimesini ${otherUser.displayName} profiline kopyalamak istiyor musunuz?\n\n(Kelime ${otherUser.displayName} havuzuna 1. seviye / Yeni olarak eklenecektir)`
    )
    if (!confirmed) return

    const res = await copySingleWordToUser(word, otherUser.id)
    alert(res.message)
  }

  return (
    <section className={styles.container}>
      {/* Üst Başlık ve İşlem Butonları */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Kelimeler</h1>
          <p className="muted">
            {loadedWords === undefined ? 'Kelimeler yükleniyor…' : `${rawWords.length} kayıtlı kelime`}
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
            id="btn-word-packs"
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsPacksModalOpen(true)}
            title="Hazır Seviye ve YDS Kelime Paketleri"
          >
            📦 Hazır Paketler
          </button>
          <details className={styles.moreMenu}>
            <summary className="btn btn-ghost">Diğer ▾</summary>
            <div className={styles.moreList} onClick={(e) => e.currentTarget.parentElement?.removeAttribute('open')}>
              <button id="btn-text-words" type="button" onClick={() => setIsTextWordsOpen(true)}>
                📄 Metinden kelime bul
              </button>
              <button id="btn-bulk-import" type="button" onClick={() => setIsBulkModalOpen(true)}>
                ⇅ İçe / dışa aktar
              </button>
              {allUsers.length > 1 && (
                <button id="btn-transfer-words" type="button" onClick={() => setIsTransferModalOpen(true)}>
                  ⇄ Profiller arası aktar
                </button>
              )}
            </div>
          </details>
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
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => toggleViewMode('list')}
              title="Liste görünümü"
            >
              <span>☰</span> Liste
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

          {/* Grup / Deste Filtresi */}
          <select
            className={styles.filterSelect}
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            aria-label="Grup ve deste filtresi"
            style={{ fontWeight: 600, color: selectedGroup !== 'all' ? 'var(--primary)' : undefined }}
          >
            <option value="all">🎯 Tüm Gruplar / Seviyeler</option>
            <optgroup label="Yerleşik Seviyeler & YDS">
              {BUILT_IN_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.shortName}
                </option>
              ))}
            </optgroup>
            {customGroups.length > 0 && (
              <optgroup label="Özel Destelerim">
                {customGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    📁 {g.name} ({g.wordIds?.length || 0})
                  </option>
                ))}
              </optgroup>
            )}
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
            {filteredWords.length} kelime
          </span>
        </div>
      </div>

      {/* Liste / Kart İçeriği */}
      {loadedWords === undefined ? (
        <div className={styles.loadingList} aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ) : rawWords.length === 0 ? (
        <div className={`card ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>📖</div>
          <h2>Henüz kelime eklemediniz</h2>
          <p className="muted" style={{ maxWidth: '420px' }}>
            YDS çalışmalarınıza başlamak için tek tek kelime ekleyebilir, hazır listenizi toplu yükleyebilir veya örnek kelimeleri yükleyebilirsiniz.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => setIsPacksModalOpen(true)}>
              📦 Hazır Kelime Paketlerini Yükle
            </button>
            <button type="button" className="btn" onClick={() => setIsAddModalOpen(true)}>
              + Kelime Ekle
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
              📥 Toplu İçe Aktar
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
      ) : (
        <>
          {viewMode === 'list' ? (
            <ul className={styles.wordList}>
              {filteredWords.slice(0, shown).map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  card={cardMap.get(word.id)}
                  open={openId === word.id}
                  onToggle={() => setOpenId((id) => (id === word.id ? null : word.id))}
                >
                  <WordCard
                    word={word}
                    cardState={cardMap.get(word.id)}
                    onEdit={(w) => setEditingWord(w)}
                    onDelete={(id) => void handleDeleteWord(id)}
                    onTransfer={otherUser ? handleTransferSingleWord : undefined}
                    onAssignGroup={(w) => setGroupingWord(w)}
                    otherUserName={otherUser?.displayName}
                  />
                </WordRow>
              ))}
            </ul>
          ) : (
            <WordTable
              words={filteredWords.slice(0, shown)}
              cardMap={cardMap}
              onEdit={(w) => setEditingWord(w)}
              onDelete={(id) => void handleDeleteWord(id)}
              onTransfer={otherUser ? handleTransferSingleWord : undefined}
              onAssignGroup={(w) => setGroupingWord(w)}
              otherUserName={otherUser?.displayName}
            />
          )}
          {filteredWords.length > shown && (
            <div className={styles.moreRow}>
              <span className="muted">
                {shown} / {filteredWords.length} gösteriliyor
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => setShown((n) => n + PAGE)}>
                {Math.min(PAGE, filteredWords.length - shown)} kelime daha göster
              </button>
            </div>
          )}
        </>
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

      {/* Kelimeyi Grupla & Desteye Ekle Modalı */}
      {groupingWord && (
        <AssignGroupModal
          word={groupingWord}
          activeUserId={activeUserId}
          onClose={() => setGroupingWord(null)}
        />
      )}

      {/* Toplu İçe Aktarma Modalı */}
      {isBulkModalOpen && (
        <BulkImportModal
          onClose={() => setIsBulkModalOpen(false)}
          onImport={handleBulkImport}
          onOpenPacks={() => setIsPacksModalOpen(true)}
          allWords={rawWords}
          filteredWords={filteredWords}
          cardMap={cardMap}
        />
      )}

      {/* Profiller Arası Kelime Aktarma Modalı */}
      {isTransferModalOpen && (
        <TransferWordsModal
          activeUserId={activeUserId}
          allUsers={allUsers}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => setIsTransferModalOpen(false)}
        />
      )}

      {isTextWordsOpen && (
        <TextWordsModal activeUserId={activeUserId} onClose={() => setIsTextWordsOpen(false)} onSuccess={() => undefined} />
      )}

      {/* Hazır Kelime Paketleri Modalı */}
      {isPacksModalOpen && (
        <WordPacksModal
          activeUserId={activeUserId}
          activeUserName={activeUser?.displayName || 'Kullanıcı'}
          onClose={() => setIsPacksModalOpen(false)}
          onSuccess={() => setIsPacksModalOpen(false)}
        />
      )}
    </section>
  )
}
