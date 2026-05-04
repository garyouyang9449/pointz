FROM node:22-alpine AS deps
WORKDIR /app
# bcrypt has native bindings; provide build tools for any platform-specific install.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=build /app/dist ./dist
COPY db ./db
EXPOSE 3000
# Run pending migrations as a release_command (see fly.toml); start server unconditionally.
CMD ["node", "dist/server.js"]
