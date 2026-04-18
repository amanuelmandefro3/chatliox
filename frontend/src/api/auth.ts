import client from './client'
import type { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types/auth'

export const login = (data: LoginRequest): Promise<TokenResponse> =>
  client.post<TokenResponse>('/auth/login', data).then((r) => r.data)

export const register = (data: RegisterRequest): Promise<TokenResponse> =>
  client.post<TokenResponse>('/auth/register', data).then((r) => r.data)

export const getMe = (): Promise<User> =>
  client.get<User>('/auth/me').then((r) => r.data)
