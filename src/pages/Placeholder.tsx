import styles from './Placeholder.module.css'

interface Props {
  title: string
  description: string
  step: string
}

/** Henüz geliştirilmemiş ekranlar için geçici içerik. */
export function Placeholder({ title, description, step }: Props) {
  return (
    <section className={`card ${styles.box}`}>
      <span className={styles.badge}>{step}</span>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </section>
  )
}
