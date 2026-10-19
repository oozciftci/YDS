import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Yapay zekâ yanıtındaki sade Markdown'ı (başlık, madde, **kalın**, [bağlantı](/adres)) güvenli biçimde gösterir;
// HTML yorumlanmaz. Bağlantılar yalnızca `isAllowedLink` izin verirse ve uygulama içi adresse tıklanabilir olur.

type LinkCheck = (href: string) => boolean

function bold(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${keyBase}-b${i}`}>{part.slice(2, -2)}</strong> : part,
  )
}

function inline(text: string, isAllowedLink?: LinkCheck): ReactNode[] {
  if (!isAllowedLink) return bold(text, 't')
  const out: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    out.push(...bold(text.slice(last, m.index), `s${k}`))
    const [, label, href] = m
    // Yalnızca "/" ile başlayan ve haritada olan adresler; dış bağlantı asla tıklanabilir olmaz
    out.push(
      href.startsWith('/') && isAllowedLink(href) ? (
        <Link key={`l${k}`} to={href} style={{ color: 'var(--primary)', fontWeight: 600 }}>
          {label} →
        </Link>
      ) : (
        <span key={`l${k}`}>{label}</span>
      ),
    )
    last = m.index + m[0].length
    k++
  }
  out.push(...bold(text.slice(last), `e${k}`))
  return out
}

export function AiText({ text, isAllowedLink }: { text: string; isAllowedLink?: LinkCheck }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    blocks.push(
      <ul key={blocks.length} style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.2rem' }}>
        {list.map((l, i) => (
          <li key={i}>{inline(l, isAllowedLink)}</li>
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
          {inline(heading[1], isAllowedLink)}
        </p>
      ) : (
        <p key={blocks.length} style={{ margin: '0.25rem 0' }}>
          {inline(line, isAllowedLink)}
        </p>
      ),
    )
  }
  flush()
  return <div style={{ lineHeight: 1.6 }}>{blocks}</div>
}
