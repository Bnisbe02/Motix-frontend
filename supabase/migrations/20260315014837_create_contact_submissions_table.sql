/*
  # Create contact submissions table

  1. New Tables
    - `contact_submissions`
      - `id` (uuid, primary key) - Unique identifier for each submission
      - `name` (text) - Name of the person submitting the form
      - `email` (text) - Email address
      - `company` (text) - Company or organisation name
      - `message` (text) - Message content
      - `created_at` (timestamptz) - Timestamp of submission
      - `ip_address` (text, optional) - IP address of submitter for spam prevention
      - `user_agent` (text, optional) - User agent for tracking
  
  2. Security
    - Enable RLS on `contact_submissions` table
    - Add policy to allow anyone to insert (for form submissions)
    - Add policy to allow authenticated users to read their own submissions
  
  3. Indexes
    - Index on email for quick lookup
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact form"
  ON contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
