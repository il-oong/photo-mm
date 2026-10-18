FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV CHROMIUM_PATH=""
CMD ["node", "src/index.js"]
