import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { commentsService, type SongComment } from '../../services/commentsService'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { Spinner, Avatar } from './common'
import { resolveImageUrl } from '../../lib/config'
import { formatDate } from '../../lib/formatters'

export default function CommentSection({ songId }: { songId: string }) {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [comments, setComments] = useState<SongComment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await commentsService.getForSong(songId)
    if (r.success) { const d = r.data as { comments?: SongComment[] }; setComments(d?.comments || []) }
    setLoading(false)
  }, [songId])
  useEffect(() => { load() }, [load])

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated()) { toast.show('Please login to comment', 'info'); return navigate('/login') }
    if (text.trim().length < 1) return
    setPosting(true)
    const r = await commentsService.post(songId, text.trim())
    setPosting(false)
    if (!r.success) return toast.show(r.error || 'Failed to post comment', 'error')
    setText('')
    load()
  }

  const like = async (c: SongComment) => {
    if (!isAuthenticated()) return toast.show('Please login to like comments', 'info')
    const r = await commentsService.like(c._id)
    if (r.success) setComments((prev) => prev.map((x) => (x._id === c._id ? { ...x, likeCount: (x.likeCount || 0) + 1 } : x)))
  }

  const del = async (c: SongComment) => {
    const r = await commentsService.delete(c._id)
    if (!r.success) return toast.show(r.error || 'Failed to delete', 'error')
    setComments((prev) => prev.filter((x) => x._id !== c._id))
    toast.show('Comment deleted', 'success')
  }

  const report = async (c: SongComment) => {
    const r = await commentsService.report(c._id, 'Inappropriate')
    toast.show(r.success ? 'Comment reported' : r.error || 'Failed', r.success ? 'success' : 'error')
  }

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
        <i className="fas fa-comments text-primary" /> Comments
        <span className="text-sm text-[#b3b3b3] font-normal">({comments.length})</span>
      </h2>

      <form onSubmit={post} className="flex gap-3 mb-8">
        <Avatar src={resolveImageUrl(user?.avatar)} className="w-10 h-10 rounded-full object-cover shrink-0" />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isAuthenticated() ? 'Add a comment...' : 'Login to join the conversation'}
            rows={2}
            maxLength={1000}
            className="w-full px-4 py-2.5 bg-[#050505] border border-[#2a2a2a] rounded-lg text-white placeholder:text-[#b3b3b3] outline-none focus:border-primary transition-colors resize-none"
          />
          <div className="flex justify-end mt-2">
            <button type="submit" className="btn-primary btn-sm" disabled={posting || !text.trim()}>{posting ? 'Posting…' : 'Comment'}</button>
          </div>
        </div>
      </form>

      {loading ? <Spinner /> : comments.length === 0 ? (
        <p className="text-[#b3b3b3] text-center py-8">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => {
            const mine = c.user?._id && user?._id && c.user._id === user._id
            return (
              <div key={c._id} className="flex gap-3">
                <Avatar src={resolveImageUrl(c.user?.avatar)} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{c.user?.username || 'User'}</span>
                    {c.createdAt && <span className="text-xs text-[#666]">{formatDate(c.createdAt, 'relative')}</span>}
                  </div>
                  <p className="text-sm text-[#ddd] mb-2 break-words">{c.content}</p>
                  <div className="flex items-center gap-4 text-xs text-[#b3b3b3]">
                    <button onClick={() => like(c)} className="hover:text-secondary bg-transparent border-none"><i className="fas fa-heart mr-1" />{c.likeCount || 0}</button>
                    {mine
                      ? <button onClick={() => del(c)} className="hover:text-danger bg-transparent border-none"><i className="fas fa-trash mr-1" />Delete</button>
                      : <button onClick={() => report(c)} className="hover:text-warning bg-transparent border-none"><i className="fas fa-flag mr-1" />Report</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
