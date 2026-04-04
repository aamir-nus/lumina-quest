FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/package.json
RUN npm ci
COPY web ./web

#build args for API URL (defaults to localhost:4000 for local dev)
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app/web
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
