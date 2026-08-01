/*
  # Supabase Dashboard Security Checklist

  SOC2 CC6 — Authentication Controls

  The following cannot be configured via SQL. Complete these in the
  Supabase Dashboard before going to production.

  ✅ COMPLETED: Disable public email signups
     Authentication → Providers → Email → "Enable sign ups" → OFF

  ⬜ REQUIRED: Enable MFA enforcement
     Authentication → Policies → Enable MFA
     Set: "Multi-Factor Authentication (MFA)" to REQUIRED for all users

  ⬜ REQUIRED: Verify session duration matches policy
     Authentication → Policies
     JWT expiry: 3600 (1 hour) — matches session timeout hook
     Refresh token expiry: 604800 (7 days) — acceptable for pilot

  ⬜ REQUIRED: Configure Auth webhook for audit completeness (optional enhancement)
     Database → Webhooks → Create webhook
     Events: INSERT on auth.audit_log_entries
     Endpoint: your Supabase Edge Function URL
     Note: login/logout events are now captured in useAuth.ts —
     this webhook would add additional coverage at the infrastructure level.

  ⬜ REQUIRED: Add ALLOWED_EMAILS to Supabase Vault
     Settings → Vault → New Secret
     Name: ALLOWED_EMAILS
     Value: comma-separated list of permitted email addresses
     e.g.: planner@bastion.com.au,buyer@bastion.com.au

  After completing all items above, re-run the compliance checklist.
*/

SELECT 1;
