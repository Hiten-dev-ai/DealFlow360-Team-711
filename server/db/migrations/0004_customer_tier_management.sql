BEGIN;

ALTER TABLE customer_tiers
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMIT;
