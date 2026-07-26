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

# ⚠️ THIS CMD DOES NOT RUN IN PRODUCTION. railway.json sets
# `deploy.startCommand`, and a Railway start command REPLACES the image CMD
# entirely. Assuming otherwise cost us the `SessionFeedback` table: the
# migration existed and was committed, but neither the schema shim nor
# `prisma migrate deploy` ever executed on a real boot, so the feedback endpoint
# and the admin voice-of-customer panel 500ed in production for weeks while
# every local check passed. The production boot path is railway.json's
# startCommand — change schema bootstrapping THERE, and keep this in sync.
#
# Note the live `_prisma_migrations` ledger has only a handful of rows against
# ~30 migration directories: this database was built by the idempotent shim, not
# by Prisma's ledger. Re-enabling `prisma migrate deploy` on boot would make it
# attempt every unrecorded migration against populated tables, and with `&&` a
# single failure means the server never starts. Baseline the ledger with
# `prisma migrate resolve --applied <name>` first. See docs/RELEASING.md.
CMD ["sh", "-c", "node scripts/ensure-critical-columns.mjs && node server.mjs"]
