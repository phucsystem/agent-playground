-- Add request/response logging columns to webhook_delivery_logs for debugging
ALTER TABLE webhook_delivery_logs
  ADD COLUMN IF NOT EXISTS request_payload jsonb,
  ADD COLUMN IF NOT EXISTS response_body text,
  ADD COLUMN IF NOT EXISTS webhook_url text;
