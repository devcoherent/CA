import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/errors'

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** Uploads a small image (max 2 MB) to a public bucket folder and returns its public URL. */
export function ImageUpload({
  bucket,
  folder,
  currentUrl,
  label,
  onUploaded,
  shape = 'circle',
}: {
  bucket: 'avatars' | 'logos'
  folder: string
  currentUrl: string | null
  label: string
  onUploaded: (url: string) => Promise<void> | void
  shape?: 'circle' | 'square'
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!TYPES.includes(file.type)) return setError('Please choose a PNG, JPG, WebP or GIF image.')
    if (file.size > MAX_BYTES) return setError('That image is larger than 2 MB. Please choose a smaller one.')
    setBusy(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${folder}/${Date.now()}.${ext}`
    const { error: err } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
    if (err) {
      setBusy(false)
      return setError(friendlyError(err))
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    await onUploaded(data.publicUrl)
    setBusy(false)
  }

  const round = shape === 'circle' ? 'rounded-full' : 'rounded-field'
  return (
    <div className="flex items-center gap-4">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface ${round}`}>
        {currentUrl ? <img src={currentUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted">None</span>}
      </div>
      <div>
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : label}
        </button>
        <p className="hint">PNG, JPG, WebP or GIF. Max 2 MB.</p>
        {error && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <input ref={input} type="file" accept={TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </div>
  )
}
