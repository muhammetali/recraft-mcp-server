# Build stage — devDependencies are needed for tsc and are then discarded.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# `sharp` ships prebuilt binaries per platform; --omit=dev keeps the image to
# the runtime set the security policy pins.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# The server talks MCP over stdio and never opens a port. It also never needs
# to write outside the paths a caller names, so it runs unprivileged.
USER node

ENTRYPOINT ["node", "dist/index.js"]
