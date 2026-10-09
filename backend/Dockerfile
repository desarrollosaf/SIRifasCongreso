FROM node:20-alpine
# Cliente mariadb: importar respaldos .sql de SAF
RUN apk add --no-cache mariadb-client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc && cp -r src/assets dist/assets
RUN mkdir -p storage
EXPOSE 3018
CMD ["node", "dist/index.js"]
