# Build stage
FROM node:20-alpine AS builder

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Install server dependencies and build
COPY server/package*.json ./server/
RUN cd server && npm ci

COPY server/ ./server/
RUN cd server && npm run build

# Production stage
FROM node:20-alpine

# Install build tools for native modules (better-sqlite3 needs rebuild)
RUN apk add --no-cache python3 make g++

WORKDIR /app
RUN mkdir -p server/data

# Copy server production deps and rebuild native modules
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server build
COPY --from=builder /app/server/dist ./server/dist

# Copy client build
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite database
RUN mkdir -p /app/server/data

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
