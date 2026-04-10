import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './models/database.js';
import { roomRoutes } from './routes/rooms.js';
import { questionRoutes } from './routes/questions.js';
import { setupSocketHandlers } from './socket/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = isProd
  ? (process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : true) // allow all if not specified
  : ['http://localhost:3000', 'http://localhost:5173'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: allowedOrigins === true ? '*' : allowedOrigins,
}));
app.use(express.json());

// Initialize database
const db = initDatabase();

// API Routes
app.use('/api/rooms', roomRoutes(db));
app.use('/api/questions', questionRoutes(db));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocketHandlers(io, db);

// Serve static client files in production
// server/dist/index.js → ../../client/dist = /app/client/dist
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
console.log(`📁 Client dist path: ${clientDistPath}`);

app.use(express.static(clientDistPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Failed to send index.html:', err);
      res.status(500).send('App loading error. Client build may be missing.');
    }
  });
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🎮 Millionaire server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
