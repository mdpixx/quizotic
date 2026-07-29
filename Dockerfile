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

# The boot chain lives in ONE place: package.json's `start` script
# (`npm run repair-schema && node server.mjs`). Both this CMD and railway.json's
# startCommand just call it, so they cannot drift apart.
#
# Two hard-won reasons it is arranged this way:
#
# 1. A Railway `deploy.startCommand` REPLACES this CMD entirely. When the schema
#    shim lived only here, it never ran in production — which is how the
#    `SessionFeedback` table stayed missing for weeks (migration committed, code
#    shipped in #103/#104, endpoint 500ing on Prisma P2021) while every local
#    check passed.
# 2. Railway does NOT run startCommand through a shell. Putting `a && b` there
#    passes `&&` to the first binary as bare argv: the shim ran, node exited 0,
#    the container stopped, and the deploy FAILED with no npm banner in the log.
#    npm runs script bodies through sh, so the chaining belongs in the script.
#
# `prisma migrate deploy` is deliberately NOT in the chain. The live
# `_prisma_migrations` ledger holds a handful of rows against ~30 migration
# directories — this database is built by the idempotent shim, not by Prisma's
# ledger. Re-enabling migrate deploy would attempt every unrecorded migration
# against populated tables, and one failure in the chain means the server never
# starts. Baseline with `prisma migrate resolve --applied <name>` first.
CMD ["npm", "run", "start"]
