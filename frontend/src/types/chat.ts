export type ConversationStatus = 'open' | 'waiting' | 'closed'
export type SenderType = 'admin' | 'visitor'

export interface Conversation {
  id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: ConversationStatus
  last_message_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  content: string
  is_read: boolean
  created_at: string
}

// WebSocket event discriminated union — every frame has a `type` field
export type WsMessageEvent  = Message & { type: 'message' }
export type WsTypingEvent   = { type: 'typing';   user_id: string | null; is_typing: boolean }
export type WsPresenceEvent = { type: 'presence'; user_id: string; status: 'online' | 'offline' }
export type WsEvent = WsMessageEvent | WsTypingEvent | WsPresenceEvent

export interface CreateConversationRequest {
  visitor_id: string
  visitor_name?: string
  visitor_email?: string
  widget_key: string
}

export interface CreateMessageRequest {
  conversation_id: string
  content: string
  sender_type: SenderType
}
