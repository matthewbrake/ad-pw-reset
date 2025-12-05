# Dockerfile Source

Here is the logic used in the Dockerfile for this application.

## Single Stage: Node.js Server
We now use a single `node:18-alpine` container. This handles both the React build process and serving the application via Express. This eliminates configuration errors associated with Nginx.

```dockerfile
# Use Node.js for both building and running (No Nginx)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to cache dependencies
COPY package*.json ./

# Install all dependencies (including devDependencies for the build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React frontend (Outputs to /app/dist)
RUN npm run build

# Expose the internal port (Server.js listens on 3000 by default)
EXPOSE 3000

# Start the Node.js server which serves the frontend AND the API
CMD ["node", "server.js"]
```