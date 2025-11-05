# Use Node.js LTS version
FROM node:22.14.0-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.8.1

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose port (Heroku sets this dynamically)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]