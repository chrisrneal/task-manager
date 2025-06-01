-- Add options column to fields table for select/radio field options
ALTER TABLE fields ADD COLUMN IF NOT EXISTS options text[];
