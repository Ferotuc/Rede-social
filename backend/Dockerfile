FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/campus.db
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node","dist/main.js"]
