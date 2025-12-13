
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to cache dependencies
COPY package*.json ./

# Install all dependencies with verbose logging for debugging
RUN npm install --verbose

# Copy the rest of the application code
COPY . .

# Build the React frontend (Outputs to /app/dist)
RUN npm run build

# Expose the internal port
EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.js"]
