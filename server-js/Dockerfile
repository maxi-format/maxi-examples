FROM node:20-alpine

WORKDIR /app/server-js

# Install dependencies
COPY server-js/package.json server-js/package-lock.json* ./
RUN npm install

# browser client served as static files by express
COPY client-js/browser-client/ /app/client-js/browser-client/

# Shared schema + seed data — baked into image, never written to
COPY shared/ /app/shared/

# Copy server source
COPY server-js/ ./

EXPOSE 4000
CMD ["node", "server.js"]
