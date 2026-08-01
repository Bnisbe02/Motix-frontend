import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
  SUPABASE DASHBOARD SETUP REQUIRED:

  1. Authentication → Providers → Google
     - Enable Google provider
     - Add OAuth credentials from Google Cloud Console
     - Authorised redirect URI to add in Google Console:
       https://your-project.supabase.co/auth/v1/callback

  2. Authentication → URL Configuration
     - Site URL: https://your-deployed-domain.com
     - Redirect URLs (add all of these):
       https://your-deployed-domain.com/auth/callback
       http://localhost:5173/auth/callback

  3. Authentication → Email Templates (optional)
     - Customise with MOTIX branding if using magic link as fallback

  4. If restricting access to approved emails only:
     Authentication → Hooks → Add a signup hook that checks
     the email domain or a pre-approved list before allowing registration.
     Alternatively use an Edge Function triggered on auth.users insert.
*/
