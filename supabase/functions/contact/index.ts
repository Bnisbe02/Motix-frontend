import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Origins allowed to call this function. Configure the production domain(s) via
// the ALLOWED_ORIGINS secret (comma-separated) so requests from the live site
// are not blocked by CORS. Localhost defaults are always permitted for local dev.
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
];

const ALLOWED_ORIGINS = [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
];

// Where new enquiries are delivered. Override with CONTACT_NOTIFICATION_EMAIL.
const NOTIFICATION_EMAIL =
  Deno.env.get("CONTACT_NOTIFICATION_EMAIL") ?? "beats@fibrecast.com.au";

// Envelope "from" address for the notification. Many providers require this to
// match the authenticated SMTP account (SMTP_USER). Override with CONTACT_FROM_EMAIL.
const FROM_EMAIL =
  Deno.env.get("CONTACT_FROM_EMAIL") ?? Deno.env.get("SMTP_USER") ?? "noreply@fibrecast.com.au";

// SMTP connection settings (provider-agnostic). Set these as Supabase secrets:
//   SMTP_HOST  - e.g. smtp.gmail.com | smtp.office365.com | mail.your-host.com
//   SMTP_PORT  - 465 (implicit TLS, default) or 587 (STARTTLS)
//   SMTP_USER  - full mailbox / login
//   SMTP_PASS  - app password (recommended) or mailbox password
//   SMTP_TLS   - "true" (default) for port 465; set "false" for 587/STARTTLS
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_TLS = (Deno.env.get("SMTP_TLS") ?? "true").toLowerCase() !== "false";

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
};

interface ContactFormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Send the enquiry notification to the MOTIX inbox over SMTP.
 * Returns true on success. Never throws — a delivery failure must not lose the
 * enquiry, which is already persisted in contact_submissions.
 */
const sendNotificationEmail = async (data: ContactFormData): Promise<boolean> => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error(
      "SMTP not configured - enquiry stored but no email sent. Set the secrets: " +
        "supabase secrets set SMTP_HOST=... SMTP_USER=... SMTP_PASS=...",
    );
    return false;
  }

  const { name, email, company, message } = data;

  const html = `
    <h2>New MOTIX enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(company)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
  `;

  const text =
    `New MOTIX enquiry\n\n` +
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Company: ${company}\n\n` +
    `Message:\n${message}\n`;

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_TLS,
      auth: {
        username: SMTP_USER,
        password: SMTP_PASS,
      },
    },
  });

  try {
    await client.send({
      from: FROM_EMAIL,
      to: NOTIFICATION_EMAIL,
      replyTo: email,
      subject: `New MOTIX enquiry from ${name}${company ? ` (${company})` : ""}`,
      content: text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send notification email over SMTP:", error);
    return false;
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData: ContactFormData = await req.json();

    const { name, email, company, message } = formData;

    if (!name || !email || !company || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate limiting: max 3 submissions per hour per IP
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIP)
      .gte("created_at", oneHourAgo);

    if (count !== null && count >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many submissions. Please try again later." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { error } = await supabase
      .from("contact_submissions")
      .insert([
        {
          name,
          email,
          company,
          message,
          ip_address: clientIP,
          user_agent: userAgent,
        },
      ]);

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit form" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Auto-direct the enquiry to the MOTIX inbox. The submission is already
    // persisted above, so a delivery failure is logged but does not fail the
    // request - the enquiry is not lost.
    const emailSent = await sendNotificationEmail(formData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contact form submitted successfully",
        emailSent,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
