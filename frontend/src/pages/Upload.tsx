import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadService, type UploadProgress } from '../services/uploadService'
import { toast } from '../store/toastStore'
import { GENRES, APP_CONFIG } from '../lib/config'

type ContentType = 'audio' | 'video'

export default function Upload() {
  const navigate = useNavigate()
  const [type, setType] = useState<ContentType>('audio')
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [price, setPrice] = useState('0')
  const [tags, setTags] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [media, setMedia] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const mediaRef = useRef<HTMLInputElement | null>(null)
  const coverRef = useRef<HTMLInputElement | null>(null)

  const maxMB = type === 'audio' ? APP_CONFIG.MAX_AUDIO_SIZE_MB : APP_CONFIG.MAX_VIDEO_SIZE_MB
  const accept = type === 'audio' ? 'audio/*' : 'video/*'

  const pickMedia = (f: File | null) => {
    if (!f) return
    if (f.size > maxMB * 1024 * 1024) { setError(`File too large. Max ${maxMB}MB for ${type}.`); return }
    setError('')
    setMedia(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!media) return setError(`Please select ${type === 'audio' ? 'an audio' : 'a video'} file`)
    if (!title.trim()) return setError('Title is required')
    if (!genre) return setError('Please select a genre')
    if (isPremium && (!price || parseFloat(price) <= 0)) return setError('Premium content requires a price greater than 0')
    if (cover && cover.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) return setError(`Cover too large. Max ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB.`)

    const fd = new FormData()
    fd.append(type === 'audio' ? 'audio' : 'video', media)
    if (cover) fd.append('coverArt', cover)
    fd.append('title', title.trim())
    fd.append('genre', genre)
    fd.append('isVideo', String(type === 'video'))
    if (isPremium) { fd.append('isPremium', 'true'); fd.append('price', price) }
    if (tags.trim()) tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => fd.append('tags', t))
    if (lyrics.trim()) fd.append('lyrics', lyrics.trim())

    setUploading(true); setProgress(0)
    const onProgress = (p: UploadProgress) => setProgress(p.percent)
    const { promise } = uploadService.uploadSong(fd, onProgress)
    const result = await promise
    setUploading(false)
    if (!result.success) { setError(result.error || 'Upload failed'); return }
    toast.show('Uploaded! Your track will be reviewed before publishing.', 'success')
    setTimeout(() => navigate('/artist-dashboard'), 1200)
  }

  return (
    <main className="max-w-[760px] mx-auto px-5 py-12">
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-3"><i className="fas fa-upload text-primary" /> Upload</h1>
      <p className="text-[#b3b3b3] mb-8">Share your music with Zambia and the world.</p>

      <div className="flex gap-2 mb-6">
        {(['audio', 'video'] as ContentType[]).map((t) => (
          <button key={t} type="button" onClick={() => { setType(t); setMedia(null) }}
            className={`px-5 py-2.5 rounded-lg font-medium border transition-colors ${type === t ? 'bg-primary text-white border-primary' : 'bg-[#1a1a1a] text-[#b3b3b3] border-[#2a2a2a] hover:text-white'}`}>
            <i className={`fas fa-${t === 'audio' ? 'music' : 'video'} mr-2`} />{t === 'audio' ? 'Audio' : 'Video'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/10' : 'border-[#2a2a2a] hover:border-primary hover:bg-primary/5'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickMedia(e.dataTransfer.files[0]) }}
          onClick={() => mediaRef.current?.click()}
        >
          <input ref={mediaRef} type="file" accept={accept} className="hidden" onChange={(e) => pickMedia(e.target.files?.[0] || null)} />
          <i className="fas fa-cloud-upload-alt text-5xl text-[#b3b3b3] mb-4 block" />
          {media ? (
            <div><p className="text-primary font-medium">{media.name}</p><p className="text-xs text-[#b3b3b3] mt-1">{(media.size / 1024 / 1024).toFixed(1)} MB</p></div>
          ) : (
            <div><p className="text-white font-medium mb-1">Drop your {type} file here</p><p className="text-[#b3b3b3] text-sm">or click to browse — up to {maxMB}MB</p></div>
          )}
        </div>

        <div className="form-group"><label>Title *</label><input type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title..." /></div>
        <div className="form-group"><label>Genre *</label><select value={genre} onChange={(e) => setGenre(e.target.value)}><option value="">Select genre...</option>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>

        <div className="form-group">
          <label>Cover Art (optional)</label>
          <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:border-primary transition-colors" onClick={() => coverRef.current?.click()}>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => setCover(e.target.files?.[0] || null)} />
            {cover ? <img src={URL.createObjectURL(cover)} className="w-16 h-16 rounded object-cover" alt="" /> : <div className="w-16 h-16 rounded bg-[#2a2a2a] flex items-center justify-center"><i className="fas fa-image text-[#b3b3b3] text-xl" /></div>}
            <div><p className="text-sm font-medium">{cover ? cover.name : 'Add cover art'}</p><p className="text-xs text-[#b3b3b3]">JPG/PNG, max {APP_CONFIG.MAX_IMAGE_SIZE_MB}MB</p></div>
          </div>
        </div>

        <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} /> Premium content (requires a price)</label></div>
        {isPremium && <div className="form-group"><label>Price (Kwacha) *</label><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}

        <div className="form-group"><label>Tags (comma-separated)</label><input type="text" maxLength={200} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="afrobeat, zambian, new" /></div>
        <div className="form-group"><label>Lyrics (optional)</label><textarea rows={4} maxLength={5000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} /></div>

        {uploading && (
          <div>
            <div className="flex justify-between text-sm mb-1"><span>Uploading…</span><span>{progress}%</span></div>
            <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {error && <p className="text-danger text-sm flex items-center gap-2"><i className="fas fa-exclamation-circle" />{error}</p>}

        <button type="submit" className="btn-primary w-full py-4" disabled={uploading}>
          {uploading ? <><i className="fas fa-spinner fa-spin" /> Uploading…</> : <><i className="fas fa-cloud-upload-alt" /> Upload {type === 'audio' ? 'Song' : 'Video'}</>}
        </button>
      </form>
    </main>
  )
}
