import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BulkImportModal } from '../components/BulkImportModal'
import { TransferWordsModal } from '../components/TransferWordsModal'
import { WordCard } from '../components/WordCard'
import { WordModal } from '../components/WordModal'
import { WordPacksModal } from '../components/WordPacksModal'
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
import type { WordItem } from '../types/database'
import styles from './Words.module.css'

export function WordsPage() {
  const { activeUser, allUsers } = useUserStore()
  const activeUserId = activeUser?.id || 'user_ozgur'

  // Canlı Kelime Listesi
  const rawWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPos, setSelectedPos] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedDiff, setSelectedDiff] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  // Görünüm Modu ('cards' | 'table')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('yds.words_view_mode') as 'cards' | 'table') || 'cards'
  })

  // Modal State'leri
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordItem | null>(null)
  const [groupingWord, setGroupingWord] = useState<WordItem | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isPacksModalOpen, setIsPacksModalOpen] = useState(false)

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
            id="btn-word-packs"
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsPacksModalOpen(true)}
            title="Hazır Seviye ve YDS Kelime Paketleri"
          >
            📦 Hazır Paketler
          </button>
          <button
            id="btn-bulk-import"
            type="button"
            className="btn"
            onClick={() => setIsBulkModalOpen(true)}
          >
            📥 Toplu İçe Aktar
          </button>
          {allUsers.length > 1 && (
            <button
              id="btn-transfer-words"
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsTransferModalOpen(true)}
              title="Özgür ve İzafet arasında kelime kopyalama / aktarma"
            >
              ⇄ Profiller Arası Aktar
            </button>
          )}
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
      ) : viewMode === 'cards' ? (
        <div className={styles.cardsGrid}>
          {filteredWords.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              cardState={cardMap.get(word.id)}
              onEdit={(w) => setEditingWord(w)}
              onDelete={(id) => void handleDeleteWord(id)}
              onTransfer={otherUser ? handleTransferSingleWord : undefined}
              onAssignGroup={(w) => setGroupingWord(w)}
              otherUserName={otherUser?.displayName}
            />
          ))}
        </div>
      ) : (
        <WordTable
          words={filteredWords}
          cardMap={cardMap}
          onEdit={(w) => setEditingWord(w)}
          onDelete={(id) => void handleDeleteWord(id)}
          onTransfer={otherUser ? handleTransferSingleWord : undefined}
          onAssignGroup={(w) => setGroupingWord(w)}
          otherUserName={otherUser?.displayName}
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
