import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversations } from '@/api/conversations'
import { getMessages, sendMessage } from '@/api/messages'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import type { Conversation, Message, WsEvent } from '@/types/chat'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function visitorLabel(c: Conversation): string {
  return c.visitor_name ?? c.visitor_email ?? 'Anonymous visitor'
}

interface Props {
  conversationId: string
}

export default function AdminChatWindow({ conversationId }: Props) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const { setOnline, setOffline, setTyping, typingUsers, clear: clearPresence } = usePresenceStore()

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState('')
  const [wsConnected, setWsConnected] = useState(false)

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
  })

  const conversation = conversations.find((c) => c.id === conversationId)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
  })

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const appendMessage = useCallback(
    (msg: Message) => {
      queryClient.setQueryData<Message[]>(['messages', conversationId], (prev = []) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
    },
    [queryClient, conversationId]
  )

  useEffect(() => {
    clearPresence()
    let active = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      wsRef.current?.close()
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.DEV
        ? window.location.host
        : (import.meta.env.VITE_API_URL as string).replace(/^https?:\/\//, '')
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      const ws = new WebSocket(`${proto}//${host}/ws/conversations/${conversationId}?${params}`)
      wsRef.current = ws

      ws.onopen = () => setWsConnected(true)

      ws.onmessage = (event: MessageEvent) => {
        try {
          const evt = JSON.parse(event.data as string) as WsEvent
          if (evt.type === 'message') {
            appendMessage(evt)
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
          } else if (evt.type === 'typing') {
            setTyping(evt.user_id ?? 'visitor', evt.is_typing)
          } else if (evt.type === 'presence') {
            evt.status === 'online' ? setOnline(evt.user_id) : setOffline(evt.user_id)
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        if (!active) return
        reconnectTimer = setTimeout(connect, 2_000)
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
      clearPresence()
    }
  }, [conversationId, appendMessage, queryClient, token, setOnline, setOffline, setTyping, clearPresence])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
    }
  }, [])

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    sendTyping(true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => sendTyping(false), 2_000)
  }

  const { mutate: send, isPending } = useMutation({
    mutationFn: sendMessage,
    onSuccess: (newMsg) => {
      appendMessage(newMsg)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setContent('')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping(false)
    send({ conversation_id: conversationId, content: content.trim(), sender_type: 'admin' })
  }

  const isTyping = typingUsers.size > 0

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {conversation ? visitorLabel(conversation) : '…'}
          </p>
          {conversation?.visitor_email && conversation.visitor_name && (
            <p className="text-xs text-gray-400 truncate">{conversation.visitor_email}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full transition-colors ${
            wsConnected ? 'bg-green-400' : 'bg-gray-300 animate-pulse'
          }`} />
          <span className="text-xs text-gray-400 hidden sm:inline">
            {wsConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>

        {conversation && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
            ${conversation.status === 'waiting' ? 'bg-amber-50 text-amber-600' :
              conversation.status === 'open'    ? 'bg-green-50 text-green-600' :
                                                  'bg-gray-100 text-gray-500'}`}>
            {conversation.status}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200"
      >
        {isLoading && (
          <p className="text-center text-sm text-gray-400 py-8">Loading messages…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet.</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div className={`px-5 bg-gray-50 transition-all duration-200 overflow-hidden ${
        isTyping ? 'h-7 opacity-100' : 'h-0 opacity-0'
      }`}>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-end gap-0.5 h-3">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          Visitor is typing…
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3 flex-shrink-0"
      >
        <textarea
          value={content}
          onChange={handleContentChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e as unknown as FormEvent)
            }
          }}
          placeholder="Type a message… (Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition max-h-36"
        />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition flex-shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.sender_type === 'admin'

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm
        ${isAdmin
          ? 'bg-brand-500 text-white rounded-br-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <p className={`text-xs mt-1.5 text-right ${isAdmin ? 'text-brand-100' : 'text-gray-400'}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}
