FROM node:22-alpine

WORKDIR /app

# Add Python + LibreOffice + poppler for PPTX slide rendering
RUN apk add --no-cache \
  python3 py3-pip \
  libreoffice-impress \
  poppler-utils \
  font-noto \
  ttf-liberation

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

CMD ["node", "server.mjs"]
