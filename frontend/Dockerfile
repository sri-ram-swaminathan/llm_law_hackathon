# Context = repo root (frontend imports ../contracts/fixtures via @fixtures).
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend ./
COPY contracts /app/contracts
ARG VITE_API_URL=http://127.0.0.1:20000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 20001
