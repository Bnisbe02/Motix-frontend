/*
  # Add RLS read policy for contact_submissions

  1. Security
    - Add policy for authenticated users to read all contact submissions
    - This allows admin/agency users to view incoming contact form submissions
*/

CREATE POLICY "Authenticated users can read contact submissions"
  ON contact_submissions
  FOR SELECT
  TO authenticated
  USING (true);
