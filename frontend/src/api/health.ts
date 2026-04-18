import client from './client'

export interface HealthResponse {
  status: string
  service: string
}

export const getHealth = (): Promise<HealthResponse> =>
  client.get<HealthResponse>('/health').then((r) => r.data)
