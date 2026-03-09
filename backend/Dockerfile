# Stage 1: Build
FROM node:20.19.0-alpine AS build

# Install build dependencies for mediasoup worker
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

WORKDIR /app
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

COPY . .
# Build the TypeScript project
RUN npm run build

# Prune devDependencies to reduce image size for production
RUN npm prune --omit=dev

# Stage 2: Final Runtime Image
FROM node:20.19.0-alpine

# Mediasoup worker needs libstdc++ and libgcc at runtime
RUN apk add --no-cache libstdc++ libgcc

WORKDIR /app

# Copy production node_modules from build stage
COPY --from=build /app/node_modules ./node_modules
# Copy package.json to have some metadata if needed (optional)
COPY --from=build /app/package*.json ./
# Copy built files
COPY --from=build /app/dist ./dist

# Ensure we're in production mode
ENV NODE_ENV=production

EXPOSE 3000

# SFU Media Ports (need to be exposed if not host networking)
EXPOSE 4443/udp
EXPOSE 4443/tcp

CMD ["node", "dist/main"]
