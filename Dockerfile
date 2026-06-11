FROM node:22-alpine

WORKDIR /app

# Add Python + LibreOffice + poppler for PPTX slide rendering.
# Retry apk add up to 5 times with backoff to survive transient I/O errors
# during package extraction. llvm21-libs (a transitive dep of mesa/libreoffice)
# has been observed failing to extract on Railway's build workers — likely a
# flaky storage layer. --no-cache forces a fresh download on each retry.
RUN set -eux; \
    for attempt in 1 2 3 4 5; do \
      if apk add --no-cache \
            python3 py3-pip py3-pillow \
            libreoffice \
            poppler-utils \
            font-noto \
            ttf-liberation; then \
        echo "apk add succeeded on attempt $attempt"; \
        exit 0; \
      fi; \
      echo "apk add failed on attempt $attempt — sleeping $((attempt * 3))s before retry"; \
      sleep $((attempt * 3)); \
    done; \
    echo "apk add failed after 5 attempts"; \
    exit 1

COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST

RUN npx prisma generate
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

EXPOSE 4000

# Ensure critical columns exist (idempotent schema shim — see
# scripts/ensure-critical-columns.mjs) BEFORE prisma migrate deploy, so drift
# between _prisma_migrations and actual DDL can't strand users at the save path.
# Then apply any pending Prisma migrations, then start the server.
CMD ["sh", "-c", "node scripts/ensure-critical-columns.mjs && npx prisma migrate deploy && node server.mjs"]
