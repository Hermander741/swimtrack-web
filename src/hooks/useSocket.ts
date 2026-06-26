import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { BASE, getAccessToken, tryRefresh } from '../api/client'

export function useSocket(): React.MutableRefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(BASE, {
      auth: { token: getAccessToken() ?? '' },
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
    })

    socket.on('connect_error', async (err) => {
      if (err.message !== 'auth-error') return
      const ok = await tryRefresh()
      if (ok) {
        socket.auth = { token: getAccessToken() ?? '' }
        socket.connect()
      }
    })

    socket.on('connect', () => {
      socket.emit('join-channels')
    })

    socketRef.current = socket
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  return socketRef
}
