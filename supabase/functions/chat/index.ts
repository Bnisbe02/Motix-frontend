/*
  MOTIX Chat Edge Function - RAG Implementation

  DEPLOYMENT REQUIREMENTS:
  This function requires the following Supabase Vault secrets to be set:
    supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key

  The SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
  automatically injected by the Supabase Edge Function runtime.

  REQUIRED TABLES (must exist before this function is meaningful):
    - detections: ts_utc, station, brand, duration_sec, confidence, creative_id
    - bookings: station, brand, start_date, end_date, total_spots, flighting

  The function handles missing tables gracefully - it will return
  "no detections found" context if the tables do not yet exist,
  rather than throwing an error.

  Deploy: supabase functions deploy chat
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://your-production-domain.netlify.app", // Replace with actual production domain
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
};

interface AnthropicMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  messages: AnthropicMessage[];
  system: string;
}

interface Detection {
  ts_utc: string;
  station: string;
  brand: string;
  duration_sec: number;
  confidence: number;
  creative_id: string;
}

interface Booking {
  station: string;
  brand: string;
  start_date: string;
  end_date: string;
  total_spots: number;
  flighting: string;
}

interface QueryFilters {
  brand: string | null;
  station: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

function extractQueryFilters(messageText: string): QueryFilters {
  const text = messageText.toLowerCase();

  // Brand extraction - check for known Australian radio advertisers and generic patterns
  const KNOWN_BRANDS = [
    'toyota', 'mazda', 'honda', 'nissan', 'hyundai', 'volkswagen',
    'commonwealth bank', 'cba', 'westpac', 'anz', 'nab', 'st george',
    'woolworths', 'coles', 'aldi', 'bunnings',
    'qantas', 'jetstar', 'virgin australia',
    'telstra', 'optus', 'vodafone',
    'harvey norman', 'jb hi-fi', 'kmart', 'target',
    'government nsw', 'australia post',
  ];

  let brand: string | null = null;
  for (const known of KNOWN_BRANDS) {
    if (text.includes(known)) {
      brand = known.toUpperCase();
      break;
    }
  }

  // Station extraction
  const KNOWN_STATIONS = [
    'kiis 106.5', 'kiis', '2mmm', 'triple m', '3aw', 'gold 104.3',
    'fox fm', 'wsfm', '2gb', '2ue', '2day', 'nova 969', 'nova',
    'star fm cairns', '4ca cairns', 'mmm cairns', 'hiit cairns',
    '3cs', '3ha', '2qn',
  ];

  let station: string | null = null;
  for (const known of KNOWN_STATIONS) {
    if (text.includes(known)) {
      station = known;
      break;
    }
  }

  // Date range extraction
  const now = new Date();
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (text.includes('today')) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    dateFrom = start.toISOString();
    dateTo = now.toISOString();
  } else if (text.includes('yesterday')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    dateFrom = start.toISOString();
    dateTo = end.toISOString();
  } else if (text.includes('this week') || text.includes('past week') || text.includes('last 7')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    dateFrom = start.toISOString();
    dateTo = now.toISOString();
  } else if (text.includes('this month') || text.includes('past month') || text.includes('last 30')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    dateFrom = start.toISOString();
    dateTo = now.toISOString();
  } else if (text.includes('last 24') || text.includes('24 hours')) {
    const start = new Date(now);
    start.setHours(start.getHours() - 24);
    dateFrom = start.toISOString();
    dateTo = now.toISOString();
  }

  // Default to last 7 days if no date hint and a brand or station was found
  // This ensures specific queries return useful results without a date constraint
  if (!dateFrom && (brand || station)) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    dateFrom = start.toISOString();
    dateTo = now.toISOString();
  }

  return { brand, station, dateFrom, dateTo };
}

function buildDetectionContext(
  detections: Detection[],
  bookings: Booking[],
  filters: QueryFilters
): string {
  const lines: string[] = [];

  // Header
  lines.push('=== MOTIX REAL-TIME DETECTION DATA ===');
  lines.push(`Query executed at: ${new Date().toISOString()}`);

  if (filters.brand) lines.push(`Brand filter: ${filters.brand}`);
  if (filters.station) lines.push(`Station filter: ${filters.station}`);
  if (filters.dateFrom) lines.push(`Date from: ${filters.dateFrom}`);
  if (filters.dateTo) lines.push(`Date to: ${filters.dateTo}`);
  lines.push('');

  // Detections summary
  if (detections.length === 0) {
    lines.push('DETECTIONS: No detections found matching the query criteria.');
  } else {
    lines.push(`DETECTIONS: ${detections.length} verified spot${detections.length !== 1 ? 's' : ''} found`);
    if (detections.length === 100) {
      lines.push('Note: Results capped at 100. Narrow your query by brand, station, or date range for complete data.');
    }
    lines.push('');

    // Aggregate by station
    const byStation = detections.reduce<Record<string, number>>((acc, d) => {
      acc[d.station] = (acc[d.station] ?? 0) + 1;
      return acc;
    }, {});

    lines.push('Breakdown by station:');
    for (const [stn, count] of Object.entries(byStation)) {
      lines.push(`  ${stn}: ${count} spot${count !== 1 ? 's' : ''}`);
    }
    lines.push('');

    // Aggregate by daypart
    const DAYPARTS: Record<string, number> = {};
    for (const d of detections) {
      const aestHour = parseInt(
        new Intl.DateTimeFormat('en-AU', {
          timeZone: 'Australia/Sydney',
          hour: 'numeric',
          hour12: false,
        }).format(new Date(d.ts_utc))
      );
      const daypart =
        aestHour >= 6 && aestHour < 9 ? 'Breakfast (6-9am)' :
        aestHour >= 9 && aestHour < 12 ? 'Morning (9am-12pm)' :
        aestHour >= 12 && aestHour < 14 ? 'Midday (12-2pm)' :
        aestHour >= 14 && aestHour < 16 ? 'Afternoon (2-4pm)' :
        aestHour >= 16 && aestHour < 19 ? 'Drive (4-7pm)' :
        aestHour >= 19 && aestHour < 22 ? 'Evening (7-10pm)' :
        'Overnight';
      DAYPARTS[daypart] = (DAYPARTS[daypart] ?? 0) + 1;
    }

    lines.push('Breakdown by daypart (AEST):');
    for (const [dp, count] of Object.entries(DAYPARTS)) {
      lines.push(`  ${dp}: ${count} spot${count !== 1 ? 's' : ''}`);
    }
    lines.push('');

    // Average confidence
    const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
    lines.push(`Average confidence score: ${(avgConfidence * 100).toFixed(1)}%`);
    lines.push('');

    // Most recent 10 detections as a log
    lines.push('Most recent detections (up to 10):');
    const recent = detections.slice(0, 10);
    for (const d of recent) {
      const localTime = new Date(d.ts_utc).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
      lines.push(
        `  ${localTime} AEST | ${d.station} | ${d.brand} | ${d.duration_sec}s | ${(d.confidence * 100).toFixed(1)}% confidence`
      );
    }
  }

  lines.push('');

  // Bookings context
  if (bookings.length === 0) {
    lines.push('BOOKINGS: No booking schedule loaded for this campaign.');
    lines.push('Note: Booking import is available via the Campaign Delivery widget in the dashboard.');
  } else {
    lines.push(`BOOKINGS: ${bookings.length} booking line${bookings.length !== 1 ? 's' : ''} on file`);
    for (const b of bookings) {
      lines.push(`  ${b.station} | ${b.brand} | ${b.start_date} to ${b.end_date} | ${b.total_spots} spots contracted`);
    }
  }

  lines.push('');
  lines.push('=== END DETECTION DATA ===');
  lines.push('');
  lines.push('Answer the user\'s question using the detection data above. Be specific - cite station names, times in AEST, spot counts, and confidence scores where relevant. If the data does not contain information needed to answer the question, say so clearly rather than guessing.');

  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Step 1: Verify JWT using user-scoped client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SOC2 CC6.1 — Server-side access control
    // Mirrors the client-side VITE_ALLOWED_EMAILS gate.
    // Set ALLOWED_EMAILS as a Supabase Vault secret (comma-separated).
    // Leave empty to allow all authenticated users (development default).
    const allowedEmailsEnv = Deno.env.get('ALLOWED_EMAILS') ?? '';
    if (allowedEmailsEnv.trim() !== '') {
      const allowedEmails = allowedEmailsEnv
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);

      if (!allowedEmails.includes((user.email ?? '').toLowerCase())) {
        return new Response(
          JSON.stringify({ error: 'Access not permitted' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Rate limiting: 100 messages per user per hour
    const serviceClientForRateLimit = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { count: messageCount } = await serviceClientForRateLimit
      .from("chat_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (messageCount !== null && messageCount >= 100) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. You can send up to 100 messages per hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await serviceClientForRateLimit
      .from("chat_usage")
      .insert({ user_id: user.id });

    // Step 2: Parse request
    const { messages, system }: ChatRequest = await req.json();

    const MAX_MESSAGES = 20;
    const MAX_CONTENT_LENGTH = 4000;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitisedMessages = messages
      .slice(-MAX_MESSAGES)
      .map(m => ({
        role: m.role,
        content: typeof m.content === "string"
          ? m.content.slice(0, MAX_CONTENT_LENGTH)
          : m.content,
      }));

    // Step 3: Extract intent from the latest user message
    const latestUserMessage = [...messages]
      .reverse()
      .find(m => m.role === "user");

    const filters = latestUserMessage
      ? extractQueryFilters(latestUserMessage.content)
      : { brand: null, station: null, dateFrom: null, dateTo: null };

    // Step 4: Query detections using service role client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let detectionsQuery = serviceClient
      .from("detections")
      .select("ts_utc, station, brand, duration_sec, confidence, creative_id")
      .order("ts_utc", { ascending: false })
      .limit(100);

    if (filters.brand) {
      detectionsQuery = detectionsQuery.ilike("brand", `%${filters.brand}%`);
    }
    if (filters.station) {
      detectionsQuery = detectionsQuery.ilike("station", `%${filters.station}%`);
    }
    if (filters.dateFrom) {
      detectionsQuery = detectionsQuery.gte("ts_utc", filters.dateFrom);
    }
    if (filters.dateTo) {
      detectionsQuery = detectionsQuery.lte("ts_utc", filters.dateTo);
    }

    const { data: detectionsData } = await detectionsQuery;
    const detections: Detection[] = detectionsData ?? [];

    // Step 5: Query bookings - graceful fallback if table does not exist yet
    let bookings: Booking[] = [];
    try {
      let bookingsQuery = serviceClient
        .from("bookings")
        .select("station, brand, start_date, end_date, total_spots, flighting")
        .limit(50);

      if (filters.brand) {
        bookingsQuery = bookingsQuery.ilike("brand", `%${filters.brand}%`);
      }

      const { data: bookingsData } = await bookingsQuery;
      bookings = bookingsData ?? [];
    } catch {
      // bookings table does not exist yet - continue without booking context
    }

    // Step 6: Build enriched system prompt
    const detectionContext = buildDetectionContext(detections, bookings, filters);
    const enrichedSystem = `${system}\n\n${detectionContext}`;

    // Step 7: Verify Anthropic key
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 8: Call Anthropic with enriched context
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: enrichedSystem,
        messages: sanitisedMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log to Supabase edge function logs only - never expose to client
      void errorText;
      return new Response(
        JSON.stringify({ error: "AI service request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // SOC2 CC6 — Audit logging
    await serviceClientForRateLimit
      .from('access_log')
      .insert({
        user_id: user.id,
        user_email: user.email ?? 'unknown',
        event_type: 'chat_query',
        resource: 'detections',
        metadata: {
          message_count: sanitisedMessages.length,
          has_brand_filter: filters.brand !== null,
          has_station_filter: filters.station !== null,
          has_date_filter: filters.dateFrom !== null,
        },
        ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
        user_agent: req.headers.get('user-agent') ?? 'unknown',
      });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
