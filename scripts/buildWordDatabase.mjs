import fs from 'node:fs'
import path from 'node:path'

async function main() {
  console.log('Fetching datasets from GitHub...')
  
  // 1. Fetch Oxford 3000 with Turkish translations
  const r1 = await fetch('https://raw.githubusercontent.com/ciwga/Oxford3000_Vocab/main/oxford3000_vocabulary_with_collocations_and_definitions_datasets.csv')
  if (!r1.ok) throw new Error('Failed to fetch ciwga CSV: ' + r1.status)
  const csvText = await r1.text()
  console.log('Oxford 3000 CSV fetched, length:', csvText.length)

  // 2. Fetch Oxford 5000 CEFR levels
  const r2 = await fetch('https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/master/full-word.json')
  if (!r2.ok) throw new Error('Failed to fetch tyypgzl JSON: ' + r2.status)
  const oxford5000 = await r2.json()
  console.log('Oxford 5000 JSON fetched, items:', oxford5000.length)

  // Map CEFR levels
  const levelMap = new Map()
  for (const item of oxford5000) {
    if (item.value && item.value.word && item.value.level) {
      levelMap.set(item.value.word.toLowerCase().trim(), item.value.level)
    }
  }

  // Robust CSV Parser
  function parseCSV(text) {
    const rows = []
    let curRow = []
    let curVal = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      const next = text[i + 1]

      if (c === '"') {
        if (inQuotes && next === '"') {
          curVal += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (c === ',' && !inQuotes) {
        curRow.push(curVal.trim())
        curVal = ''
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++
        curRow.push(curVal.trim())
        if (curRow.some(col => col.length > 0)) {
          rows.push(curRow)
        }
        curRow = []
        curVal = ''
      } else {
        curVal += c
      }
    }
    if (curVal.length > 0 || curRow.length > 0) {
      curRow.push(curVal.trim())
      rows.push(curRow)
    }
    return rows
  }

  const rows = parseCSV(csvText)
  console.log('Total parsed rows:', rows.length)

  const header = rows[0]
  console.log('Header:', header)

  function mapPos(rawPos) {
    const p = (rawPos || '').toLowerCase().trim()
    if (p.includes('phrasal')) return 'phrasal_verb'
    if (p.includes('verb')) return 'verb'
    if (p.includes('noun')) return 'noun'
    if (p.includes('adj')) return 'adjective'
    if (p.includes('adv')) return 'adverb'
    if (p.includes('prep')) return 'preposition'
    if (p.includes('conj')) return 'conjunction'
    if (p.includes('idiom')) return 'idiom'
    return 'other'
  }

  const allWords = []
  const seenTerms = new Set()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 5) continue

    const term = row[0].replace(/^"|"$/g, '').trim()
    const defEn = row[1].replace(/^"|"$/g, '').trim()
    const tr = row[2].replace(/^"|"$/g, '').trim()
    const example = row[3].replace(/^"|"$/g, '').trim()
    const rawPos = row[4].replace(/^"|"$/g, '').trim()
    const rawSyn = (row[6] || '').replace(/^"|"$/g, '').trim()
    const rawAnt = (row[7] || '').replace(/^"|"$/g, '').trim()
    const rawCol = (row[8] || '').replace(/^"|"$/g, '').trim()

    if (!term || !tr || tr === 'none' || seenTerms.has(term.toLowerCase())) {
      continue
    }

    seenTerms.add(term.toLowerCase())

    const level = levelMap.get(term.toLowerCase()) || 'B1'
    let difficulty = 3
    if (level === 'A1') difficulty = 1
    else if (level === 'A2') difficulty = 2
    else if (level === 'B1') difficulty = 3
    else if (level === 'B2') difficulty = 4
    else if (level === 'C1' || level === 'C2') difficulty = 5

    const synonyms = rawSyn && rawSyn !== 'none'
      ? rawSyn.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'none')
      : []

    const antonyms = rawAnt && rawAnt !== 'none'
      ? rawAnt.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'none')
      : []

    const collocations = rawCol && rawCol !== 'none'
      ? rawCol.split(',').map(s => s.trim()).filter(s => s.length > 0 && s !== 'none')
      : []

    const tags = [level]
    if (level === 'A1' || level === 'A2') {
      tags.push('Başlangıç', 'Temel-İngilizce')
    } else if (level === 'B1' || level === 'B2') {
      tags.push('Orta', 'Genel-İngilizce')
    } else {
      tags.push('İleri', 'YDS-Akademik')
    }

    const pos = mapPos(rawPos)
    if (pos === 'verb') tags.push('Fiil')
    else if (pos === 'noun') tags.push('İsim')
    else if (pos === 'adjective') tags.push('Sıfat')
    else if (pos === 'adverb') tags.push('Zarf')
    else if (pos === 'phrasal_verb') tags.push('Phrasal-Verb')
    else if (pos === 'conjunction') tags.push('Bağlaç')

    const sentences = []
    if (example && example !== 'none') {
      sentences.push({ en: example })
    }

    allWords.push({
      term,
      definition: tr, // Ana Türkçe anlam
      partOfSpeech: pos,
      synonyms,
      antonyms,
      collocations,
      sentences,
      tags,
      difficulty,
      notes: defEn && defEn !== 'none' ? defEn : undefined
    })
  }

  console.log('Successfully structured words:', allWords.length)

  // Partition by levels
  const a1_a2_words = allWords.filter(w => w.tags.includes('A1') || w.tags.includes('A2'))
  const b1_b2_words = allWords.filter(w => w.tags.includes('B1') || w.tags.includes('B2'))
  const c1_c2_words = allWords.filter(w => w.tags.includes('C1') || w.tags.includes('C2') || w.tags.includes('İleri'))

  console.log('A1-A2 count:', a1_a2_words.length)
  console.log('B1-B2 count:', b1_b2_words.length)
  console.log('C1-C2 (YDS) count:', c1_c2_words.length)

  // Ensure public/data directory exists
  const publicDataDir = path.resolve(process.cwd(), 'public/data')
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true })
  }

  // Write full dataset to public/data/oxford3000_tr.json
  const fullJsonPath = path.join(publicDataDir, 'oxford3000_tr.json')
  fs.writeFileSync(fullJsonPath, JSON.stringify(allWords), 'utf8')
  console.log('Wrote', allWords.length, 'words to', fullJsonPath)

  // Summary file for metadata
  const summary = {
    totalWords: allWords.length,
    levels: {
      a1_a2: a1_a2_words.length,
      b1_b2: b1_b2_words.length,
      c1_c2: c1_c2_words.length
    },
    generatedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(publicDataDir, 'packs_meta.json'), JSON.stringify(summary, null, 2), 'utf8')
  console.log('Build completed successfully!')
}

main().catch(err => {
  console.error('Build error:', err)
  process.exit(1)
})
