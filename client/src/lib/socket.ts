import { io, Socket } from 'socket.io-client';

// Single socket instance for the app
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In production, connect to same origin (no URL needed)
    // In dev, Vite proxies /socket.io to localhost:4000
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });
  }

  return socket;
}
