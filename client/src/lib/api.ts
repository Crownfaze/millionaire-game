// Backend base URL — set VITE_BACKEND_URL in production (Railway URL)
// In dev, Vite proxies /api to localhost:4000 so we use empty string
export const API_BASE = import.meta.env.VITE_BACKEND_URL ?? '';
