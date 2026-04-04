FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY server ./server

WORKDIR /app/server
EXPOSE 4000
CMD ["node", "src/index.js"]
