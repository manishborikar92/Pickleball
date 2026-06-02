DROP INDEX IF EXISTS "active_refresh_tokens_session_idx";

CREATE UNIQUE INDEX "active_refresh_tokens_session_idx"
ON "refresh_tokens" ("session_id")
WHERE "revoked_at" IS NULL;
