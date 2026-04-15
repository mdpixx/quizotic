-- Add apiKey column for Public REST API v1 Bearer token auth
ALTER TABLE "User" ADD COLUMN "apiKey" TEXT;
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
