import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';

// Single socket instance for the app
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In dev, Vite proxies /socket.io to localhost:4000 (empty string = same origin)
    // In production (Vercel), VITE_BACKEND_URL points to Railway backend
    socket = io(API_BASE, {
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
