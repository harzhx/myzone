# Lightweight production Node.js container
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY tools/ ./tools/
COPY dashboard/ ./dashboard/

# Expose default port
EXPOSE 8000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8000

# Run server
CMD ["node", "server.js"]
