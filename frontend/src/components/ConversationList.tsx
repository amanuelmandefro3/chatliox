import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getConversations } from '@/api/conversations'
import type { Conversation, ConversationStatus } from '@/types/chat'

type Filter = 'all' | ConversationStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function visitorLabel(c: Conversation): string {
  return c.visitor_name ?? c.visitor_email ?? 'Anonymous visitor'
}

function avatarInitial(c: Conversation): string {
  const label = visitorLabel(c)
  return label[0]?.toUpperCase() ?? '?'
}

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-rose-500',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface Props {
  activeId?: string
  onSelect: (id: string) => void
}

export default function ConversationList({ activeId, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
    refetchInterval: 15_000,
  })

  const filtered = filter === 'all'
    ? conversations
    : conversations.filter((c) => c.status === filter)

  const waitingCount = conversations.filter((c) => c.status === 'waiting').length

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition ${
              filter === key
                ? 'bg-brand-500 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {label}
            {key === 'waiting' && waitingCount > 0 && (
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                filter === key ? 'bg-white/20' : 'bg-amber-100 text-amber-600'
              }`}>
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
        {isLoading && (
          <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No conversations.</p>
        )}

        {filtered.map((c) => (
          <ConversationCard
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ConversationCard({
  conversation: c,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 flex items-start gap-3 transition border-l-2 ${
        isActive
          ? 'bg-brand-50 border-brand-500'
          : 'border-transparent hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold ${avatarColor(c.id)}`}>
        {avatarInitial(c)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={`text-sm truncate ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
            {visitorLabel(c)}
          </p>
          <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(c.last_message_at)}</span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-gray-400 truncate">
            {c.visitor_email && c.visitor_name ? c.visitor_email : 'No email'}
          </p>
          <StatusBadge status={c.status} />
        </div>
      </div>
    </button>
  )
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  if (status === 'open') return null
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
      status === 'waiting' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
    }`}>
      {status}
    </span>
  )
}
