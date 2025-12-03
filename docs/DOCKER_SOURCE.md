# Dockerfile Source

Here is the logic used in the Dockerfile for this application.

## 1. Build Stage
We use `node:18-alpine` to install dependencies and compile the React application.

```dockerfile
# Stage 1: Build the React Application
FROM node:18-alpine as build

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the static files (Output goes to /app/dist)
RUN npm run build
```

## 2. Production Stage
We use `nginx:alpine` to serve the static files generated in Stage 1. This is lightweight and performant.

```dockerfile
# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the built files from Stage 1 to Nginx's HTML directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config (handles React Router/SPA history mode)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```
