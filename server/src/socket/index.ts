import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifyAccess } from '../utils/jwt'
import { pool } from '../db/pool'
import { registerChatHandlers, messageTimestamps } from './chatHandlers'

export const connectedUsers = new Map<string, Set<string>>()

export function setupSocket(httpServer: HttpServer) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.some(o => origin === o.trim())) cb(null, true)
        else cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) { next(new Error('auth-error')); return }
      const payload = verifyAccess(token)
      const { rows } = await pool.query<{ id: string; email: string; name: string; role: string }>(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [payload.sub],
      )
      if (!rows[0]) { next(new Error('auth-error')); return }
      socket.data.user = rows[0]
      next()
    } catch {
      next(new Error('auth-error'))
    }
  })

  io.on('connection', (socket) => {
    const { id: userId } = socket.data.user as { id: string }

    if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set())
    connectedUsers.get(userId)!.add(socket.id)

    socket.emit('connected')

    socket.on('disconnect', () => {
      const sockets = connectedUsers.get(userId)
      sockets?.delete(socket.id)
      if (sockets?.size === 0) connectedUsers.delete(userId)
      messageTimestamps.delete(userId)
    })

    socket.on('error', (err) => {
      if ((err as Error).message === 'auth-error') {
        socket.emit('auth-error')
        socket.disconnect()
      }
    })

    registerChatHandlers(io, socket)
  })

  return io
}
