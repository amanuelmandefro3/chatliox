import client from './client'
import type { CreateMessageRequest, Message } from '@/types/chat'

export const getMessages = (conversationId: string): Promise<Message[]> =>
  client.get<Message[]>(`/conversations/${conversationId}/messages`).then((r) => r.data)

export const getVisitorMessages = (conversationId: string, visitorId: string): Promise<Message[]> =>
  client
    .get<Message[]>(`/conversations/${conversationId}/visitor-messages`, { params: { visitor_id: visitorId } })
    .then((r) => r.data)

export const sendMessage = (data: CreateMessageRequest): Promise<Message> =>
  client.post<Message>('/messages', data).then((r) => r.data)
