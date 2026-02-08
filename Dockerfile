# Stage 1: Build the React Application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production Server (Node.js)
FROM node:20-alpine

WORKDIR /app

# Copy package.json and install ONLY production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server source code
COPY server ./server

# Expose port (default 3000 or defined by env)
EXPOSE 3000

# Start the server
CMD ["node", "server/index.js"]
