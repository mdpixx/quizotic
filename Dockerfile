FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST

RUN npx prisma generate
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.mjs"]
