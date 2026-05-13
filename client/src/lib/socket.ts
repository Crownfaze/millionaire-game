import { io, Socket } from 'socket.io-client';

// In production: connect directly to Amvera backend for real WebSocket support.
// Vercel can only proxy HTTP, so going through it would force polling mode.
// In dev: empty string = same origin, Vite proxies /socket.io → localhost:4000.
const SOCKET_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_BACKEND_URL ?? 'https://millionaire.sonter.amvera.io')
  : '';

// Single socket instance for the app
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
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
