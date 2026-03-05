FROM node:20.19.0-alpine AS build

# Add build dependencies for mediasoup worker
# Mediasoup needs python3 and pip to install 'invoke' for its build system
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20.19.0-alpine

# Mediasoup worker needs libstdc++ at runtime
RUN apk add --no-cache libstdc++

WORKDIR /app
COPY package*.json ./

# Mediasoup needs to build its worker even for production if prebuilts fail (common on Alpine)
RUN apk add --no-cache python3 py3-pip make g++ linux-headers \
    && npm ci --omit=dev \
    && apk del python3 py3-pip make g++ linux-headers

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
