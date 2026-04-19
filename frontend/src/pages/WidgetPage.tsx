import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { createConversation } from '@/api/conversations'
import { getVisitorMessages, sendMessage } from '@/api/messages'
import type { Message, WsEvent } from '@/types/chat'

function widgetErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) return 'Too many requests. Please wait a moment and try again.'
    if (!error.response || error.response.status >= 500) return 'Chat is temporarily unavailable. Please try again later.'
  }
  return 'Something went wrong. Please try again.'
}

// ─── Visitor identity (namespaced per widget key to isolate tenants) ─────────

function getOrCreateVisitorId(widgetKey: string): string {
  const storageKey = `chatliox_visitor_id_${widgetKey}`
  const stored = localStorage.getItem(storageKey)
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem(storageKey, id)
  return id
}

function getStoredConversationId(widgetKey: string): string | null {
  return localStorage.getItem(`chatliox_conversation_id_${widgetKey}`)
}

function storeConversationId(widgetKey: string, id: string): void {
  localStorage.setItem(`chatliox_conversation_id_${widgetKey}`, id)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WidgetPage() {
  const [searchParams] = useSearchParams()
  const widgetKey = searchParams.get('key') ?? ''

  const [isOpen, setIsOpen] = useState(false)
  const [visitorId] = useState(() => getOrCreateVisitorId(widgetKey))
  const [conversationId, setConversationId] = useState<string | null>(
    () => getStoredConversationId(widgetKey)
  )

  // Make the iframe background transparent so it blends into the host page
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  if (!widgetKey) {
    return (
      <div className="fixed bottom-4 right-4">
        <div className="w-14 h-14 bg-gray-300 rounded-full flex items-center justify-center" title="Widget key missing" />
      </div>
    )
  }

  const handleConversationCreated = (id: string) => {
    storeConversationId(widgetKey, id)
    setConversationId(id)
  }

  return (
    <div className="fixed inset-0 flex items-end justify-end p-4 pointer-events-none">
      {/* Chat panel */}
      {isOpen && (
        <div className="pointer-events-auto mb-16 w-80 h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          <PanelHeader onClose={() => setIsOpen(false)} />
          {conversationId ? (
            <ChatView conversationId={conversationId} visitorId={visitorId} />
          ) : (
            <WelcomeView
              visitorId={visitorId}
              widgetKey={widgetKey}
              onConversationCreated={handleConversationCreated}
            />
          )}
        </div>
      )}

      {/* Launcher bubble */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="pointer-events-auto w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 flex-shrink-0"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-brand-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
          S
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Support</p>
          <p className="text-white/70 text-xs">Typically replies in minutes</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-white/70 hover:text-white transition p-1 rounded"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  )
}

// ─── Welcome screen (no conversation yet) ────────────────────────────────────

interface WelcomeViewProps {
  visitorId: string
  widgetKey: string
  onConversationCreated: (id: string) => void
}

function WelcomeView({ visitorId, widgetKey, onConversationCreated }: WelcomeViewProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firstMessage, setFirstMessage] = useState('')

  const { mutate: startChat, isPending, error: startError } = useMutation({
    mutationFn: async () => {
      const conv = await createConversation({
        visitor_id: visitorId,
        visitor_name: name.trim() || undefined,
        visitor_email: email.trim() || undefined,
        widget_key: widgetKey,
      })
      if (firstMessage.trim()) {
        await sendMessage({
          conversation_id: conv.id,
          content: firstMessage.trim(),
          sender_type: 'visitor',
        })
      }
      return conv
    },
    onSuccess: (conv) => onConversationCreated(conv.id),
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Hero strip — continues from header */}
      <div className="bg-brand-500 px-5 pb-5">
        <p className="text-white/90 text-sm leading-snug">
          👋 Hi there! Send us a message and we'll get back to you shortly.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
        />
        <input
          type="email"
          placeholder="Your email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
        />
        <textarea
          placeholder="Type your message…"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
        />

        {startError && (
          <p className="text-xs text-red-500">{widgetErrorMessage(startError)}</p>
        )}

        <button
          onClick={() => startChat()}
          disabled={!firstMessage.trim() || isPending}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition"
        >
          {isPending ? 'Starting…' : 'Start chatting →'}
        </button>
      </div>
    </div>
  )
}

// ─── Chat view (conversation exists) ─────────────────────────────────────────

interface ChatViewProps {
  conversationId: string
  visitorId: string
}

function ChatView({ conversationId, visitorId }: ChatViewProps) {
  const queryClient = useQueryClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState('')
  const [adminTyping, setAdminTyping] = useState(false)

  const { data: messages = [], isLoading, isError: messagesUnavailable } = useQuery({
    queryKey: ['widget-messages', conversationId],
    queryFn: () => getVisitorMessages(conversationId, visitorId),
    retry: 2,
  })

  // Auto-scroll when messages change
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const appendMessage = useCallback(
    (msg: Message) => {
      queryClient.setQueryData<Message[]>(['widget-messages', conversationId], (prev = []) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
    },
    [queryClient, conversationId]
  )

  // WebSocket: receive messages + admin typing indicator
  useEffect(() => {
    let active = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      wsRef.current?.close()
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.DEV
        ? window.location.host
        : (import.meta.env.VITE_API_URL as string).replace(/^https?:\/\//, '')
      const ws = new WebSocket(
        `${proto}//${host}/ws/conversations/${conversationId}?visitor_id=${visitorId}`
      )
      wsRef.current = ws

      ws.onmessage = (event: MessageEvent) => {
        try {
          const evt = JSON.parse(event.data as string) as WsEvent
          if (evt.type === 'message') appendMessage(evt)
          else if (evt.type === 'typing') setAdminTyping(evt.is_typing)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
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
    }
  }, [conversationId, visitorId, appendMessage])

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

  const { mutate: send, isPending, error: sendError } = useMutation({
    mutationFn: sendMessage,
    onSuccess: (newMsg) => {
      appendMessage(newMsg)
      setContent('')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping(false)
    send({ conversation_id: conversationId, content: content.trim(), sender_type: 'visitor' })
  }

  if (messagesUnavailable) {
    return <UnavailableState />
  }

  return (
    <>
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200"
      >
        {isLoading && (
          <p className="text-center text-xs text-gray-400 py-6">Loading…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-6">
            No messages yet.
          </p>
        )}
        {messages.map((msg) => (
          <WidgetBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Admin typing indicator */}
      <div className={`px-4 bg-gray-50 transition-all duration-200 overflow-hidden ${
        adminTyping ? 'h-7 opacity-100' : 'h-0 opacity-0'
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
          Support is typing…
        </div>
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-3 pb-1 bg-white">
          <p className="text-xs text-red-500">{widgetErrorMessage(sendError)}</p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-t border-gray-200 px-3 py-2.5 flex items-end gap-2 flex-shrink-0"
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
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition max-h-28"
        />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm font-medium transition flex-shrink-0"
        >
          Send
        </button>
      </form>
    </>
  )
}

// ─── Unavailable state (backend unreachable or rate-limited) ─────────────────

function UnavailableState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center bg-gray-50">
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700">Chat temporarily unavailable</p>
      <p className="text-xs text-gray-400">We're having trouble connecting. Please try again in a few minutes.</p>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function WidgetBubble({ message }: { message: Message }) {
  const isVisitor = message.sender_type === 'visitor'

  return (
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
        isVisitor
          ? 'bg-brand-500 text-white rounded-br-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <p className={`text-xs mt-1 text-right ${isVisitor ? 'text-brand-100' : 'text-gray-400'}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}
