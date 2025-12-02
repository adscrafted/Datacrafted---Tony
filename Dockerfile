# Production-optimized multi-stage Dockerfile for Next.js application
# This uses Node 20 Alpine for minimal image size and includes security best practices

# Stage 1: Dependencies
# Install production and development dependencies separately for better caching
FROM node:20-alpine AS deps

# Add libc6-compat for Alpine compatibility with some node modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install dependencies
# Using npm ci for reproducible builds
RUN npm ci

# Stage 2: Builder
# Build the Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Copy environment variables template (actual values injected at runtime)
# IMPORTANT: Never include .env.local in the image - use runtime env vars
COPY .env.example .env.local

# Generate Prisma Client
RUN npx prisma generate

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
# The 'standalone' output mode creates a minimal server in .next/standalone
RUN npm run build

# Stage 3: Runner
# Create the final production image
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
# Running as root is a security risk
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder
# Standalone output includes only necessary files for production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and generated client for database operations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Set port environment variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
# Ensures the container is healthy and ready to serve traffic
# Checks every 30s with 3s timeout, 3 retries before marking unhealthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the Next.js server
# The standalone server.js includes all necessary dependencies
CMD ["node", "server.js"]
