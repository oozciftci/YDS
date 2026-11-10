import { useEffect, useRef, useState } from 'react'

/** MediaRecorder ile ses kaydı. */
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000), 500)
    return () => clearInterval(t)
  }, [recording])

  // Panel kapanırsa kaydı ve mikrofonu bırak
  useEffect(
    () => () => {
      const r = recRef.current
      if (r && r.state !== 'inactive') r.stop()
      r?.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const r = new MediaRecorder(stream)
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    recRef.current = r
    startedAt.current = Date.now()
    setSeconds(0)
    r.start()
    setRecording(true)
  }

  function stop(): Promise<{ blob: Blob; seconds: number } | null> {
    const r = recRef.current
    if (!r) return Promise.resolve(null)
    return new Promise((resolve) => {
      r.onstop = () => {
        r.stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        resolve(blob.size ? { blob, seconds: (Date.now() - startedAt.current) / 1000 } : null)
      }
      r.stop()
    })
  }

  return { recording, seconds, start, stop }
}
