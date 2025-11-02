/*
  # Add date and time columns to journal_entries

  1. New Columns
    - `date` (text, format: "yyyy.MM.dd")
    - `time` (text, format: "HH.mm")
  2. Rationale
    - Allows entries to be associated with a specific calendar date (when selected from calendar)
    - Separates the entry's logical date from creation timestamp
    - Time column captures when the entry was written
  3. Migration Strategy
    - Add both columns as nullable initially
    - Populate with existing data from created_at
    - Will be made non-nullable for new entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'date'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN date text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'time'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN time text;
  END IF;
END $$;

UPDATE journal_entries
SET 
  date = to_char(created_at AT TIME ZONE 'UTC', 'YYYY.MM.DD'),
  time = to_char(created_at AT TIME ZONE 'UTC', 'HH.mm')
WHERE date IS NULL OR time IS NULL;
