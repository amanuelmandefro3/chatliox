import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversations, updateConversationStatus } from '@/api/conversations'
import { getMessages, sendMessage } from '@/api/messages'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import type { Conversation, Message, WsEvent } from '@/types/chat'

type InputMode = 'reply' | 'note'

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function visitorLabel(c: Conversation) {
  return c.visitor_name ?? c.visitor_email ?? 'Anonymous visitor'
}

export default function AdminChatWindow({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const { setOnline, setOffline, setTyping, typingUsers, clear: clearPresence } = usePresenceStore()

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState('')
  const [mode, setMode] = useState<InputMode>('reply')
  const [connected, setConnected] = useState(false)

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
  })
  const conv = conversations.find((c) => c.id === conversationId)
  const resolved = conv?.status === 'closed'

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
  })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const appendMsg = useCallback((msg: Message) => {
    queryClient.setQueryData<Message[]>(['messages', conversationId], (prev = []) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
    )
  }, [queryClient, conversationId])

  useEffect(() => {
    clearPresence()
    let active = true
    let retry: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      wsRef.current?.close()
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.DEV
        ? window.location.host
        : (import.meta.env.VITE_API_URL as string).replace(/^https?:\/\//, '')
      const ws = new WebSocket(`${proto}//${host}/ws/conversations/${conversationId}?token=${token ?? ''}`)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onmessage = ({ data }: MessageEvent) => {
        try {
          const e = JSON.parse(data as string) as WsEvent
          if (e.type === 'message') { appendMsg(e); queryClient.invalidateQueries({ queryKey: ['conversations'] }) }
          else if (e.type === 'typing') setTyping(e.user_id ?? 'visitor', e.is_typing)
          else if (e.type === 'presence') e.status === 'online' ? setOnline(e.user_id) : setOffline(e.user_id)
        } catch { /* ignore */ }
      }
      ws.onclose = () => { setConnected(false); if (active) retry = setTimeout(connect, 2_000) }
    }
    connect()
    return () => {
      active = false
      if (retry) clearTimeout(retry)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      wsRef.current?.close()
      wsRef.current = null
      clearPresence()
    }
  }, [conversationId, appendMsg, queryClient, token, setOnline, setOffline, setTyping, clearPresence])

  const sendTyping = useCallback((v: boolean) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: v }))
  }, [])

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    if (mode === 'reply') {
      sendTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => sendTyping(false), 2_000)
    }
  }

  const { mutate: send, isPending } = useMutation({
    mutationFn: sendMessage,
    onSuccess: (m) => { appendMsg(m); queryClient.invalidateQueries({ queryKey: ['conversations'] }); setContent('') },
  })

  const { mutate: resolve, isPending: resolving } = useMutation({
    mutationFn: () => updateConversationStatus(conversationId, 'closed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || resolved) return
    if (mode === 'reply') { if (typingTimer.current) clearTimeout(typingTimer.current); sendTyping(false) }
    send({ conversation_id: conversationId, content: content.trim(), sender_type: 'admin', is_internal: mode === 'note' })
  }

  return (
    // Outer container sits on the zinc-100 canvas from AdminDashboard
    <div className="h-full flex gap-4 p-4">

      {/* ── Chat card ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 tracking-tight truncate">
              {conv ? visitorLabel(conv) : '…'}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {conv?.assigned_to_name
                ? <span>Handled by <span className="text-indigo-600 font-medium">{conv.assigned_to_name}</span></span>
                : conv?.visitor_email ?? 'No reply yet'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Live dot */}
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-300 animate-pulse'}`} />
              {connected ? 'Live' : 'Connecting'}
            </span>
            {/* Resolve */}
            {resolved ? (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-lg">
                ✓ Resolved
              </span>
            ) : (
              <button
                onClick={() => resolve()}
                disabled={resolving}
                className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {resolving ? 'Resolving…' : 'Resolve'}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 bg-zinc-50/40">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-12">No messages yet.</p>
          )}
          {messages.map((m) => <Bubble key={m.id} message={m} />)}
          {resolved && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-xs text-zinc-400">Conversation resolved</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Typing indicator */}
        <div className={`px-5 bg-zinc-50/40 overflow-hidden transition-all duration-200 ${
          typingUsers.size > 0 && !resolved ? 'h-8 opacity-100' : 'h-0 opacity-0'
        }`}>
          <div className="flex items-center gap-2 text-xs text-zinc-400 h-8">
            <span className="flex gap-0.5 items-end">
              {[0, 120, 240].map((d) => (
                <span key={d} className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
            Visitor is typing…
          </div>
        </div>

        {/* Input */}
        {!resolved ? (
          <div className={`border-t flex-shrink-0 transition-colors duration-200 ${
            mode === 'note' ? 'border-amber-200 bg-amber-50/60' : 'border-zinc-100 bg-white'
          }`}>
            {/* Mode toggle */}
            <div className="flex items-center gap-1 px-4 pt-3">
              <ModeTab label="Reply" active={mode === 'reply'} onClick={() => setMode('reply')} />
              <ModeTab label="Internal Note" active={mode === 'note'} onClick={() => setMode('note')} amber />
              {mode === 'note' && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Only visible to your team
                </span>
              )}
            </div>
            <form onSubmit={submit} className="flex items-end gap-3 px-4 pb-4 pt-2">
              <textarea
                value={content}
                onChange={onChange}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e as unknown as FormEvent) } }}
                placeholder={mode === 'note' ? 'Write an internal note… (never sent to visitor)' : 'Reply to visitor… (Enter to send)'}
                rows={2}
                className={`flex-1 resize-none rounded-xl px-4 py-3 text-sm placeholder:text-zinc-400 outline-none transition-all duration-200 max-h-40 ${
                  mode === 'note'
                    ? 'bg-amber-100/60 text-amber-900 ring-1 ring-amber-300 focus:ring-amber-400 placeholder:text-amber-400'
                    : 'bg-zinc-50 text-zinc-800 ring-1 ring-zinc-200 focus:ring-zinc-300 focus:bg-white'
                }`}
              />
              <button
                type="submit"
                disabled={isPending || !content.trim()}
                className={`flex-shrink-0 disabled:opacity-40 text-white rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  mode === 'note' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {mode === 'note' ? 'Add note' : 'Send'}
              </button>
            </form>
          </div>
        ) : (
          <div className="border-t border-zinc-100 px-5 py-4 flex-shrink-0">
            <p className="text-xs text-center text-zinc-400">This conversation has been resolved.</p>
          </div>
        )}
      </div>

      {/* ── CRM sidebar card ──────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col gap-3">
        {/* Visitor info */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Visitor</p>
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {conv ? (visitorLabel(conv)[0] ?? '?').toUpperCase() : '?'}
              </div>
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {conv ? visitorLabel(conv) : '—'}
              </p>
            </div>

            <Field label="Email" value={conv?.visitor_email ?? '—'} />
            <Field label="Visitor ID" value={conv?.visitor_id ?? '—'} mono clip />
            <Field label="Started" value={conv ? fmtDate(conv.created_at) : '—'} />
            <Field label="Status" value={
              conv ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  conv.status === 'waiting' ? 'bg-amber-50 text-amber-700' :
                  conv.status === 'open'    ? 'bg-indigo-50 text-indigo-700' :
                                              'bg-emerald-50 text-emerald-700'
                }`}>{conv.status}</span>
              ) : '—'
            } />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Actions</p>
          </div>
          <div className="p-2 flex flex-col gap-0.5">
            {!resolved && (
              <ActionBtn onClick={() => resolve()} disabled={resolving} icon="✓">
                Mark resolved
              </ActionBtn>
            )}
            <ActionBtn onClick={() => setMode('note')} icon="✎">
              Add internal note
            </ActionBtn>
          </div>
        </div>
      </aside>
    </div>
  )
}

function ModeTab({ label, active, onClick, amber = false }: { label: string; active: boolean; onClick: () => void; amber?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
        active
          ? amber ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'
          : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
      }`}
    >
      {amber && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )}
      {label}
    </button>
  )
}

function Field({ label, value, mono = false, clip = false }: { label: string; value: React.ReactNode; mono?: boolean; clip?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      {typeof value === 'string'
        ? <p className={`text-xs text-zinc-700 ${mono ? 'font-mono' : ''} ${clip ? 'truncate' : 'break-all'}`}>{value}</p>
        : value}
    </div>
  )
}

function ActionBtn({ children, onClick, disabled = false, icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 disabled:opacity-40 text-left"
    >
      <span className="text-zinc-400 w-4 text-center">{icon}</span>
      {children}
    </button>
  )
}

function Bubble({ message: m }: { message: Message }) {
  const isAdmin = m.sender_type === 'admin'

  if (m.is_internal) {
    return (
      <div className="px-1">
        <div className="w-full bg-amber-50 border border-dashed border-amber-300 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
              Internal note{m.sender_name ? ` · ${m.sender_name}` : ''}
            </p>
            <p className="ml-auto text-[10px] text-amber-400 flex-shrink-0">{fmt(m.created_at)}</p>
          </div>
          <p className="text-sm text-amber-900 whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[72%] rounded-2xl px-4 py-3 ${
        isAdmin ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-zinc-200 text-zinc-800'
      }`}>
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
        <p className={`text-[11px] mt-2 text-right ${isAdmin ? 'text-indigo-200' : 'text-zinc-400'}`}>
          {fmt(m.created_at)}
        </p>
      </div>
    </div>
  )
}
