import client from './client'

export const rotateInviteToken = (): Promise<{ invite_token: string }> =>
  client.post<{ invite_token: string }>('/organizations/invite/rotate').then((r) => r.data)

export const sendInviteEmail = (email: string): Promise<void> =>
  client.post('/organizations/invite/send-email', { email }).then(() => undefined)
