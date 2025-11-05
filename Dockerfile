# Use Node.js LTS version
FROM node:22.14.0-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.8.1

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and change ownership
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml ./

# Switch to nodejs user
USER nodejs

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and change ownership
COPY --chown=nodejs:nodejs . .

# Switch back to root to build
USER root

# Build the application
RUN pnpm run build

# Switch back to nodejs user
USER nodejs

# Heroku sets the PORT environment variable
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]