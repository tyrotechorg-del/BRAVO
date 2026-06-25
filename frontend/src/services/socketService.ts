import { io, Socket } from 'socket.io-client'
import { WS_BASE_URL } from '../lib/config'

class SocketService {
  private socket: Socket | null = null

  connect(token: string): Socket {
    if (this.socket?.connected) return this.socket
    this.socket = io(WS_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    this.socket.on('connect', () => console.log('[Socket] connected', this.socket?.id))
    this.socket.on('disconnect', (r) => console.log('[Socket] disconnected', r))
    this.socket.on('connect_error', (e) => console.warn('[Socket] error', e.message))
    return this.socket
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  on(event: string, cb: (...args: unknown[]) => void) {
    this.socket?.on(event, cb)
  }
  off(event: string, cb?: (...args: unknown[]) => void) {
    this.socket?.off(event, cb)
  }
  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data)
  }
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}

export const socketService = new SocketService()
