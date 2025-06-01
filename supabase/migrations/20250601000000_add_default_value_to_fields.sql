-- Add default_value column to fields table for custom field defaults
ALTER TABLE fields ADD COLUMN IF NOT EXISTS default_value text;
