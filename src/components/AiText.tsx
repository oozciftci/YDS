import type { ReactNode } from 'react'

// Yapay zekâ yanıtındaki sade Markdown'ı (başlık, madde, **kalın**) güvenli biçimde gösterir; HTML yorumlanmaz.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

export function AiText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    blocks.push(
      <ul key={blocks.length} style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.2rem' }}>
        {list.map((l, i) => (
          <li key={i}>{inline(l)}</li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flush()
    const heading = /^#{1,4}\s+(.*)$/.exec(line)
    blocks.push(
      heading ? (
        <p key={blocks.length} style={{ margin: '0.5rem 0 0.15rem', fontWeight: 700 }}>
          {inline(heading[1])}
        </p>
      ) : (
        <p key={blocks.length} style={{ margin: '0.25rem 0' }}>
          {inline(line)}
        </p>
      ),
    )
  }
  flush()
  return <div style={{ lineHeight: 1.6 }}>{blocks}</div>
}
