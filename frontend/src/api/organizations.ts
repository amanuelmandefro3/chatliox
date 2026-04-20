import client from './client'
import type { Member, UserRole } from '@/types/auth'

export const rotateInviteToken = (): Promise<{ invite_token: string }> =>
  client.post<{ invite_token: string }>('/organizations/invite/rotate').then((r) => r.data)

export const sendInviteEmail = (email: string): Promise<void> =>
  client.post('/organizations/invite/send-email', { email }).then(() => undefined)

export const getMembers = (): Promise<Member[]> =>
  client.get<Member[]>('/organizations/members').then((r) => r.data)

export const updateMemberRole = (memberId: string, role: UserRole): Promise<Member> =>
  client.patch<Member>(`/organizations/members/${memberId}/role`, { role }).then((r) => r.data)

export const removeMember = (memberId: string): Promise<void> =>
  client.delete(`/organizations/members/${memberId}`).then(() => undefined)
