# Use Node.js LTS version
FROM node:22.14.0-alpine

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.8.1

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies as root to avoid permission issues
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Create non-root user for runtime security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to nodejs user for runtime
USER nodejs

# Heroku sets the PORT environment variable
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]