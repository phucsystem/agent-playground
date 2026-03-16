-- Add request/response logging columns to webhook_delivery_logs for debugging
ALTER TABLE webhook_delivery_logs
  ADD COLUMN request_payload jsonb,
  ADD COLUMN response_body text,
  ADD COLUMN webhook_url text;
