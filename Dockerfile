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

# =============================================================================
# BUILD-TIME ENVIRONMENT VARIABLES (NEXT_PUBLIC_*)
# =============================================================================
# These variables are baked into the client bundle at build time.
# Railway injects these automatically if you define them as build variables.
#
# To set in Railway:
# 1. Go to your project settings
# 2. Add these as "Build Variables" (not just runtime variables)
# 3. Redeploy to rebuild with the new values
# =============================================================================

# Firebase Configuration (client-side)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

# Application URL (used for metadata and CORS fallback)
ARG NEXT_PUBLIC_APP_URL

# Feature flags
ARG NEXT_PUBLIC_ENABLE_AI_ANALYSIS=true
ARG NEXT_PUBLIC_ENABLE_EXPORT=true
ARG NEXT_PUBLIC_MAX_FILE_SIZE_MB=50
ARG NEXT_PUBLIC_MAX_ROWS=100000

# Convert ARGs to ENVs so they're available during build
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ENABLE_AI_ANALYSIS=$NEXT_PUBLIC_ENABLE_AI_ANALYSIS
ENV NEXT_PUBLIC_ENABLE_EXPORT=$NEXT_PUBLIC_ENABLE_EXPORT
ENV NEXT_PUBLIC_MAX_FILE_SIZE_MB=$NEXT_PUBLIC_MAX_FILE_SIZE_MB
ENV NEXT_PUBLIC_MAX_ROWS=$NEXT_PUBLIC_MAX_ROWS

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
# The 'standalone' output mode creates a minimal server in .next/standalone
# NEXT_PUBLIC_* variables are now available from ARGs above
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

# Copy Prisma schema and generated client
# CRITICAL: The schema.prisma has binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
# This ensures the builder generates binaries for both local dev AND Alpine Linux
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Railway injects PORT env var, typically 8080)
EXPOSE 8080

# Set hostname for Next.js
ENV HOSTNAME="0.0.0.0"

# Note: Railway injects PORT automatically, don't hardcode it
# Health check disabled - Railway handles health checks externally

# Start the Next.js server
# The standalone server.js includes all necessary dependencies
CMD ["node", "server.js"]
