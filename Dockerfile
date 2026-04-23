# Stage 1: Build
<<<<<<< ours
FROM node:22-alpine AS builder
=======
FROM node:18-alpine AS builder
>>>>>>> theirs

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Stage 2: Production Dependencies
<<<<<<< ours
FROM node:22-alpine AS prod-deps
=======
FROM node:18-alpine AS prod-deps
>>>>>>> theirs

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 3: Runtime
<<<<<<< ours
FROM node:22-alpine AS runtime
=======
FROM node:18-alpine AS runtime
>>>>>>> theirs

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S stellar -u 1001

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/healthcheck.js ./healthcheck.js

# Change ownership
RUN chown -R stellar:nodejs /app

USER stellar

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["node", "dist/index.js"]
