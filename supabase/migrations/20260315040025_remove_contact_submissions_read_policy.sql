/*
  # Contact submissions read policy revision

  Read access intentionally omitted at this stage.
  The contact_submissions table is write-only for anonymous submitters.
  A scoped admin read policy will be added when the admin panel is built
  with proper role-based access control.
*/

DROP POLICY IF EXISTS "Authenticated users can read contact submissions" ON contact_submissions;
