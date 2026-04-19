import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminChatWindow from '@/components/AdminChatWindow'
import ConversationList from '@/components/ConversationList'
import { rotateInviteToken, sendInviteEmail } from '@/api/organizations'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/auth'

type View = 'inbox' | 'settings'

export default function AdminDashboard() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const logout = useAuthStore((s) => s.logout)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<View>('inbox')

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

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-100">

      {/* ── Slim nav (56px) ──────────────────────────────────────────────────── */}
      <nav className="w-14 bg-zinc-900 flex flex-col items-center py-4 flex-shrink-0">
        <div className="flex flex-col gap-1 flex-1">
          <NavBtn title="Inbox" active={view === 'inbox'} onClick={() => { setView('inbox'); navigate('/') }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
          </NavBtn>

          <NavBtn title={copied ? 'Copied!' : 'Install widget'} onClick={copyEmbed}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </NavBtn>

          <NavBtn title="Settings" active={view === 'settings'} onClick={() => setView('settings')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavBtn>
        </div>

        <button
          onClick={() => { logout(); navigate('/login') }}
          title={`Sign out — ${user?.full_name ?? ''}`}
          className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-all duration-200 text-zinc-200 text-xs font-semibold"
        >
          {initials}
        </button>
      </nav>

      {view === 'settings' ? (
        <SettingsView
          user={user}
          token={token}
          setAuth={setAuth}
        />
      ) : (
        <>
          {/* ── Inbox column ─────────────────────────────────────────────────── */}
          <aside className="w-72 bg-white border-r border-zinc-200 flex flex-col flex-shrink-0 overflow-hidden">
            <div className="px-4 pt-5 pb-3 flex-shrink-0">
              <h1 className="text-sm font-semibold text-zinc-900 tracking-tight">Inbox</h1>
              {user?.organization && (
                <p className="text-xs text-zinc-400 mt-0.5 truncate">{user.organization.name}</p>
              )}
            </div>
            <ConversationList activeId={id} onSelect={(cid) => navigate(`/c/${cid}`)} />
          </aside>

          {/* ── Workspace canvas ─────────────────────────────────────────────── */}
          <main className="flex-1 bg-zinc-100 overflow-hidden min-w-0">
            {id
              ? <AdminChatWindow conversationId={id} />
              : <EmptyState onInstall={copyEmbed} copied={copied} />
            }
          </main>
        </>
      )}
    </div>
  )
}

function SettingsView({
  user,
  token,
  setAuth,
}: {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
}) {
  const [inviteToken, setInviteToken] = useState(user?.organization?.invite_token ?? '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const inviteUrl = `${window.location.origin}/join/${inviteToken}`

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2_000)
    })
  }

  const sendEmailInvite = async () => {
    if (!inviteEmail.trim()) return
    setSending(true)
    setSendStatus('idle')
    setSendError(null)
    try {
      await sendInviteEmail(inviteEmail.trim())
      setSendStatus('sent')
      setInviteEmail('')
      setTimeout(() => setSendStatus('idle'), 3_000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSendError(msg ?? 'Failed to send. Check your SMTP settings.')
      setSendStatus('error')
    } finally {
      setSending(false)
    }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const { invite_token } = await rotateInviteToken()
      setInviteToken(invite_token)
      if (token && user) {
        const updatedUser: User = {
          ...user,
          organization: { ...user.organization, invite_token },
        }
        setAuth(token, updatedUser)
      }
    } finally {
      setRotating(false)
    }
  }

  return (
    <main className="flex-1 bg-zinc-100 overflow-auto">
      <div className="max-w-lg mx-auto py-10 px-6 flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Settings</h2>

        {/* Invite teammates */}
        <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Invite teammates</p>
            <p className="text-xs text-zinc-500 mt-0.5">Enter an email address to send an invite, or copy the link to share manually.</p>
          </div>

          {/* Email invite */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendEmailInvite()}
              className="flex-1 min-w-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
            />
            <button
              onClick={sendEmailInvite}
              disabled={!inviteEmail.trim() || sending}
              className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 text-white transition-all duration-200 ${
                sendStatus === 'sent' ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {sending ? 'Sending…' : sendStatus === 'sent' ? '✓ Sent!' : 'Send invite'}
            </button>
          </div>
          {sendStatus === 'error' && sendError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {sendError}
            </p>
          )}

          {/* Copy link */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5">Or share invite link directly</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 outline-none select-all"
              />
              <button
                onClick={copyInvite}
                className={`flex-shrink-0 text-xs font-medium px-3 py-2 rounded-lg ring-1 transition-all duration-200 ${
                  copiedInvite
                    ? 'ring-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'ring-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {copiedInvite ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={handleRotate}
            disabled={rotating}
            className="self-start text-xs font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-50 transition-colors"
          >
            {rotating ? 'Rotating…' : 'Rotate link (revokes old invites)'}
          </button>
        </div>
      </div>
    </main>
  )
}

function NavBtn({
  children, title, onClick, active = false,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
        active ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ onInstall, copied }: { onInstall: () => void; copied: boolean }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-zinc-200 p-10 flex flex-col items-center gap-5 text-center max-w-sm w-full">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-zinc-900 tracking-tight">No conversation selected</p>
          <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
            Select a thread from the inbox to start replying, or install your chat widget to begin receiving messages.
          </p>
        </div>
        <button
          onClick={onInstall}
          className={`w-full text-sm font-medium py-2.5 rounded-xl ring-1 transition-all duration-200 ${
            copied
              ? 'ring-emerald-300 bg-emerald-50 text-emerald-700'
              : 'ring-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          {copied ? '✓ Embed code copied!' : 'Copy widget install snippet'}
        </button>
      </div>
    </div>
  )
}
