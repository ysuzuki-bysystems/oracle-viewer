FROM node:22 as builder

WORKDIR /build
COPY package.json package-lock.json .
RUN npm ci

COPY . .
ENV ORACLE_CONNECTION_STRING=x
ENV ORACLE_USERNAME=x
ENV ORACLE_PASSWORD=x
RUN npm run build

FROM node:22

WORKDIR /app
COPY --from=builder /build/.next/standalone .
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/public ./public
EXPOSE 3000

CMD ["node", "./server.js"]
