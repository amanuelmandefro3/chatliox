import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getConversations } from '@/api/conversations'
import Logo from '@/components/Logo'
import { useAuthStore } from '@/store/authStore'
import type { Conversation } from '@/types/chat'

const statusDot: Record<string, string> = {
  waiting: 'bg-amber-400',
  open: 'bg-green-400',
  closed: 'bg-gray-300',
}

const statusLabel: Record<string, string> = {
  waiting: 'Waiting',
  open: 'Open',
  closed: 'Closed',
}

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

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
    refetchInterval: 10_000, // poll every 10s until we add WebSockets in Step 5
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Logo className="h-7 w-auto" variant="dark" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.full_name}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-500 transition">
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversations</h2>

        {isLoading && (
          <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="text-sm text-gray-400 py-12 text-center">No conversations yet.</div>
        )}

        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => navigate(`/chat/${c.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-brand-500 hover:shadow-sm transition"
              >
                {/* Status dot */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[c.status]}`} />

                {/* Visitor info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{visitorLabel(c)}</p>
                  {c.visitor_email && c.visitor_name && (
                    <p className="text-xs text-gray-400 truncate">{c.visitor_email}</p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-gray-400">{timeAgo(c.last_message_at)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                    ${c.status === 'waiting' ? 'bg-amber-50 text-amber-600' :
                      c.status === 'open' ? 'bg-green-50 text-green-600' :
                      'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[c.status]}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
