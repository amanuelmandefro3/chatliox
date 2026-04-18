import { create } from 'zustand'

interface PresenceState {
  onlineUsers: Set<string>
  typingUsers: Set<string>
  setOnline:  (userId: string) => void
  setOffline: (userId: string) => void
  setTyping:  (userId: string, isTyping: boolean) => void
  clear: () => void
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  onlineUsers: new Set(),
  typingUsers: new Set(),

  setOnline: (userId) =>
    set((s) => ({ onlineUsers: new Set(s.onlineUsers).add(userId) })),

  setOffline: (userId) =>
    set((s) => {
      const next = new Set(s.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),

  setTyping: (userId, isTyping) =>
    set((s) => {
      const next = new Set(s.typingUsers)
      isTyping ? next.add(userId) : next.delete(userId)
      return { typingUsers: next }
    }),

  clear: () => set({ onlineUsers: new Set(), typingUsers: new Set() }),
}))
