# --- Build del frontend Angular ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx ng build --configuration docker

# --- Servir con nginx ---
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/demo2/browser /usr/share/nginx/html
EXPOSE 80
