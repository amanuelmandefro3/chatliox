import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminChatWindow from '@/components/AdminChatWindow'
import ConversationList from '@/components/ConversationList'
import { useAuthStore } from '@/store/authStore'

export default function AdminDashboard() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [copied, setCopied] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const embedCode = user?.organization
    ? `<iframe src="${window.location.origin}/widget?key=${user.organization.widget_key}" style="position:fixed;bottom:0;right:0;width:420px;height:640px;border:none;z-index:2147483647;background:transparent;" allowtransparency="true" title="Chat Support"></iframe>`
    : ''

  const copyEmbed = () => {
    if (!embedCode) return
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    })
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 text-sm leading-tight">Chatliox</span>
            {user?.organization && (
              <span className="text-xs text-gray-400 leading-tight">{user.organization.name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Install widget button */}
          <button
            onClick={copyEmbed}
            disabled={!embedCode}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
              copied
                ? 'border-green-300 bg-green-50 text-green-600'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {copied ? '✓ Copied!' : 'Install widget'}
          </button>

          <span className="text-sm text-gray-500 hidden sm:block">{user?.full_name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-red-500 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Conversations
            </h2>
          </div>
          <ConversationList
            activeId={id}
            onSelect={(cid) => navigate(`/c/${cid}`)}
          />
        </aside>

        {/* Main panel */}
        <main className="flex-1 overflow-hidden">
          {id ? (
            <AdminChatWindow conversationId={id} />
          ) : (
            <EmptyState onInstall={copyEmbed} copied={copied} />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState({ onInstall, copied }: { onInstall: () => void; copied: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
        <span className="text-brand-500 text-2xl">💬</span>
      </div>
      <div>
        <p className="text-gray-700 font-medium">Select a conversation</p>
        <p className="text-sm text-gray-400 max-w-xs mt-1">
          Choose a conversation from the sidebar, or install your widget to start receiving messages.
        </p>
      </div>
      <button
        onClick={onInstall}
        className={`text-sm font-medium px-4 py-2 rounded-xl border transition ${
          copied
            ? 'border-green-300 bg-green-50 text-green-600'
            : 'border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100'
        }`}
      >
        {copied ? '✓ Embed code copied!' : 'Copy install snippet'}
      </button>
    </div>
  )
}
