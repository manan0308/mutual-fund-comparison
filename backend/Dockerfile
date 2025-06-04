# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install security updates and curl for health checks
RUN apk update && apk add --no-cache curl && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 3001

# Development command
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS production-build

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app

# Production stage
FROM node:18-alpine AS production

# Install security updates and curl
RUN apk update && apk add --no-cache curl && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from production-build stage
COPY --from=production-build --chown=nodeuser:nodejs /app .

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Production command
CMD ["node", "server.js"]