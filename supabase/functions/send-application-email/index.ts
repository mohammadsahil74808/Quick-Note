// ==============================================================================
// DEV MAVERICKS — Supabase Edge Function: send-application-email
// Phase 4B: Serverless Email Dispatch via Brevo Transactional API (v3)
// Supported Actions:
//   1. admin_new_application -> Notifies Admin about a new applicant
//   2. applicant_approved     -> Congratulates applicant on approval & welcomes to club
//   3. applicant_rejected     -> Politely updates applicant about cohort status
// ==============================================================================
// Security:
// - Private secrets (BREVO_API_KEY, APPLICATION_NOTIFICATION_EMAIL, etc.) are
//   read strictly from Deno.env (Supabase Vault / Edge Function Secrets).
// - NEVER exposes, returns, or logs API keys, tokens, or auth headers.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApplicationPayload {
  action?: "admin_new_application" | "applicant_approved" | "applicant_rejected";
  application_id?: string;
  full_name: string;
  email: string;
  college?: string;
  branch?: string;
  year?: string;
  track?: string;
  role?: string;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  photo_path?: string | null;
  submitted_at?: string;
  status?: string;
}

function escapeHtml(str?: string | null): string {
  if (!str) return "—";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Template 1: Admin Notification Email (New Application Received)
 */
function buildAdminNewApplicationEmail(app: ApplicationPayload): string {
  const name = escapeHtml(app.full_name);
  const email = escapeHtml(app.email);
  const college = escapeHtml(app.college || "Lingaya's Vidyapeeth");
  const branch = escapeHtml(app.branch || "Computer Science & Engineering (CSE)");
  const year = escapeHtml(app.year || "1st Year");
  const track = escapeHtml(app.track || "General");
  const appId = escapeHtml(app.application_id || "N/A");
  const submittedAt = app.submitted_at ? new Date(app.submitted_at).toUTCString() : new Date().toUTCString();
  const status = escapeHtml(app.status || "Pending");

  const githubLink = app.github_url 
    ? `<a href="${escapeHtml(app.github_url)}" style="color: #39D353; text-decoration: none; font-family: monospace;">${escapeHtml(app.github_url)}</a>` 
    : `<span style="color: #64748b;">Not provided</span>`;

  const linkedinLink = app.linkedin_url 
    ? `<a href="${escapeHtml(app.linkedin_url)}" style="color: #38bdf8; text-decoration: none; font-family: monospace;">${escapeHtml(app.linkedin_url)}</a>` 
    : `<span style="color: #64748b;">Not provided</span>`;

  const portfolioLink = app.portfolio_url 
    ? `<a href="${escapeHtml(app.portfolio_url)}" style="color: #a78bfa; text-decoration: none; font-family: monospace;">${escapeHtml(app.portfolio_url)}</a>` 
    : `<span style="color: #64748b;">Not provided</span>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New DEV MAVERICKS Membership Application</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070B10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070B10; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #0d131a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Green Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #39D353, #38bdf8);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                      DEV <span style="color: #39D353;">MAVERICKS</span>
                    </div>
                    <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px; letter-spacing: 0.05em;">
                      // COMMUNITY PORTAL NOTIFICATION
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-family: monospace; font-weight: 600; background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 9999px; text-transform: uppercase;">
                      ${status}
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 20px 0 6px;">
                New Membership Application
              </h1>
              <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.5;">
                A new applicant has submitted their registration via the DEV MAVERICKS Join Us portal.
              </p>
            </td>
          </tr>

          <!-- Section 1: Applicant Details -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 12px; font-family: monospace; color: #39D353; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; font-weight: 600;">
                ▶ Applicant Details
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">Name:</td>
                  <td style="font-size: 14px; font-weight: 600; color: #ffffff;">${name}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Email:</td>
                  <td style="font-size: 14px; color: #f8fafc;"><a href="mailto:${email}" style="color: #38bdf8; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">College:</td>
                  <td style="font-size: 14px; color: #f8fafc;">${college}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Branch:</td>
                  <td style="font-size: 14px; color: #f8fafc;">${branch}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Year:</td>
                  <td style="font-size: 14px; color: #f8fafc;">${year}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Preferred Track:</td>
                  <td style="font-size: 14px; font-weight: 600; color: #39D353;">${track}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 2: Links -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 12px; font-family: monospace; color: #39D353; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; font-weight: 600;">
                ▶ Candidate Links &amp; Profiles
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">GitHub:</td>
                  <td style="font-size: 13px;">${githubLink}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">LinkedIn:</td>
                  <td style="font-size: 13px;">${linkedinLink}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Portfolio:</td>
                  <td style="font-size: 13px;">${portfolioLink}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 3: Application Information -->
          <tr>
            <td style="padding: 24px 32px; background-color: #090e14; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 12px; font-family: monospace; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; font-weight: 600;">
                ▶ Application Metadata
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="4">
                <tr>
                  <td width="36%" style="font-size: 12px; color: #64748b; font-family: monospace;">Application ID:</td>
                  <td style="font-size: 12px; color: #94a3b8; font-family: monospace;">${appId}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; font-family: monospace;">Submitted At:</td>
                  <td style="font-size: 12px; color: #94a3b8; font-family: monospace;">${submittedAt}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; font-family: monospace;">Status:</td>
                  <td style="font-size: 12px; color: #fbbf24; font-family: monospace; font-weight: 600;">Pending Review</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #64748b; line-height: 1.6; margin: 0;">
                To review, approve, or reject this candidate, sign into the DEV MAVERICKS Admin Portal.<br>
                This automated notification was generated by the DEV MAVERICKS Supabase Community Service.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Template 2: Applicant Approval Email (Welcome & Acceptance)
 */
function buildApplicantApprovedEmail(app: ApplicationPayload): string {
  const name = escapeHtml(app.full_name);
  const track = escapeHtml(app.track || "General Track");
  const role = escapeHtml(app.role || "Member");
  const college = escapeHtml(app.college || "Lingaya's Vidyapeeth");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your DEV MAVERICKS Membership Application Has Been Approved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070B10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070B10; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #0d131a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Green Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #39D353, #38bdf8);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                      DEV <span style="color: #39D353;">MAVERICKS</span>
                    </div>
                    <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px; letter-spacing: 0.05em;">
                      // OFFICIAL MEMBERSHIP ACCEPTANCE
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-family: monospace; font-weight: 600; background-color: rgba(57, 211, 83, 0.15); color: #39D353; border: 1px solid rgba(57, 211, 83, 0.3); border-radius: 9999px; text-transform: uppercase;">
                      APPROVED
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 20px 0 6px;">
                Welcome to DEV MAVERICKS! 🎉
              </h1>
              <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">
                Congratulations, <strong style="color: #f8fafc;">${name}</strong>! Your application to join DEV MAVERICKS has been officially reviewed and <strong style="color: #39D353;">APPROVED</strong> by our core team.
              </p>
            </td>
          </tr>

          <!-- Section 1: Member Profile Details -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 12px; font-family: monospace; color: #39D353; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; font-weight: 600;">
                ▶ Your Member Profile
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">Assigned Role:</td>
                  <td style="font-size: 14px; font-weight: 600; color: #39D353;">${role}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Primary Track:</td>
                  <td style="font-size: 14px; font-weight: 600; color: #38bdf8;">${track}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Institution:</td>
                  <td style="font-size: 14px; color: #f8fafc;">${college}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Membership Status:</td>
                  <td style="font-size: 13px; color: #39D353; font-weight: 600; font-family: monospace;">Active Member</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 2: Welcome & Community Context -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b; background-color: #090e14;">
              <div style="font-size: 12px; font-family: monospace; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; font-weight: 600;">
                ▶ What You Can Look Forward To
              </div>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.7; margin: 0 0 12px;">
                You are now part of our vibrant technical collective. Together, we build impactful technology, organize flagship events, and mentor upcoming engineers:
              </p>
              <ul style="font-size: 13px; color: #94a3b8; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Collaborate on open-source, AI, web development, and cloud computing projects.</li>
                <li>Compete in national and international hackathons with our club teams.</li>
                <li>Participate in exclusive peer workshops, tech sprints, and project reviews.</li>
                <li>Your member profile is now live on our community showcase roster!</li>
              </ul>
            </td>
          </tr>

          <!-- Section 3: Official Contact & Community Channels -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 12px; font-family: monospace; color: #39D353; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; font-weight: 600;">
                ▶ Official Contact &amp; Community Channels
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="4">
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">Official Website:</td>
                  <td style="font-size: 13px;"><a href="https://devmavericks.tech" style="color: #38bdf8; text-decoration: none;">devmavericks.tech</a></td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Contact Email:</td>
                  <td style="font-size: 13px;"><a href="mailto:contact@devmavericks.tech" style="color: #38bdf8; text-decoration: none;">contact@devmavericks.tech</a></td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; font-family: monospace;">Campus Location:</td>
                  <td style="font-size: 13px; color: #f8fafc;">Lingaya's Vidyapeeth, Nachauli, Jasana Road, Faridabad, Haryana</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #64748b; line-height: 1.6; margin: 0;">
                Welcome aboard, Maverick. Let's engineer something extraordinary.<br>
                <strong>DEV MAVERICKS Core Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Template 3: Applicant Rejection Email (Empathetic Cohort Update)
 */
function buildApplicantRejectedEmail(app: ApplicationPayload): string {
  const name = escapeHtml(app.full_name);
  const track = escapeHtml(app.track || "selected");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Update on Your DEV MAVERICKS Membership Application</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070B10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070B10; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #0d131a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Amber Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #f59e0b, #64748b);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #1e293b;">
              <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                DEV <span style="color: #39D353;">MAVERICKS</span>
              </div>
              <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px; letter-spacing: 0.05em;">
                // APPLICATION STATUS UPDATE
              </div>
              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 20px 0 6px;">
                Membership Application Update
              </h1>
              <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">
                Dear <strong style="color: #f8fafc;">${name}</strong>,
              </p>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.7; margin: 0 0 16px;">
                Thank you for applying to join DEV MAVERICKS and for sharing your passion for technology in the <strong>${track}</strong> track.
              </p>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.7; margin: 0 0 16px;">
                Due to cohort team limits and specialization quotas for this induction cycle, we are unable to offer you an active membership slot at this time. We received an exceptionally high volume of applications, and this decision does not reflect upon your potential or abilities as a builder.
              </p>
              <div style="background-color: #090e14; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="font-size: 12px; font-family: monospace; color: #38bdf8; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
                  💡 Open Community Opportunities
                </div>
                <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0;">
                  Our open workshops, hackathons, seminars, and open-source project showcases are accessible to all campus students. We strongly encourage you to participate in these open initiatives, keep building your portfolio, and re-apply in our upcoming semester induction!
                </p>
              </div>
            </td>
          </tr>

          <!-- Channels & Contact -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="4">
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">Website:</td>
                  <td style="font-size: 13px;"><a href="https://devmavericks.tech" style="color: #38bdf8; text-decoration: none;">devmavericks.tech</a></td>
                </tr>
                <tr>
                  <td width="36%" style="font-size: 13px; color: #64748b; font-family: monospace;">Contact Email:</td>
                  <td style="font-size: 13px;"><a href="mailto:contact@devmavericks.tech" style="color: #38bdf8; text-decoration: none;">contact@devmavericks.tech</a></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #64748b; line-height: 1.6; margin: 0;">
                We sincerely appreciate your interest and wish you the absolute best in your coding journey.<br>
                <strong>DEV MAVERICKS Community Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      }
    );
  }

  try {
    // 2. Read Secrets from Environment
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const notificationEmail = Deno.env.get("APPLICATION_NOTIFICATION_EMAIL");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "DEV MAVERICKS";

    if (!brevoApiKey || !senderEmail) {
      console.warn("[send-application-email] Warning: Missing BREVO_API_KEY or BREVO_SENDER_EMAIL secret.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email notification service is not fully configured on the server. Missing BREVO_API_KEY or BREVO_SENDER_EMAIL.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // 3. Parse application payload
    const body: ApplicationPayload = await req.json();

    if (!body || !body.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required applicant email in request body.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Default action to admin_new_application for complete backwards compatibility
    const action = body.action || "admin_new_application";

    let emailSubject = "";
    let recipientEmail = "";
    let recipientName = "";
    let htmlContent = "";

    if (action === "admin_new_application") {
      if (!notificationEmail) {
        console.warn("[send-application-email] APPLICATION_NOTIFICATION_EMAIL secret is not set.");
        return new Response(
          JSON.stringify({
            success: false,
            error: "APPLICATION_NOTIFICATION_EMAIL secret is not set on the server.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
      emailSubject = "New DEV MAVERICKS Membership Application";
      recipientEmail = notificationEmail;
      recipientName = "DEV MAVERICKS Admin";
      htmlContent = buildAdminNewApplicationEmail(body);

    } else if (action === "applicant_approved") {
      emailSubject = "Your DEV MAVERICKS Membership Application Has Been Approved";
      recipientEmail = body.email;
      recipientName = body.full_name || "Member";
      htmlContent = buildApplicantApprovedEmail(body);

    } else if (action === "applicant_rejected") {
      emailSubject = "Update on Your DEV MAVERICKS Membership Application";
      recipientEmail = body.email;
      recipientName = body.full_name || "Applicant";
      htmlContent = buildApplicantRejectedEmail(body);

    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid action specified: '${action}'. Allowed: admin_new_application, applicant_approved, applicant_rejected.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 4. Construct Brevo Payload
    const brevoPayload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: recipientEmail,
          name: recipientName,
        },
      ],
      subject: emailSubject,
      htmlContent: htmlContent,
    };

    // 5. Call Brevo Transactional Email API (v3)
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResponse.ok) {
      console.error(
        `[send-application-email] Brevo API error status: ${brevoResponse.status} for action: ${action}`
      );
      return new Response(
        JSON.stringify({
          success: false,
          action: action,
          error: `Brevo email dispatch failed with status ${brevoResponse.status}.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        }
      );
    }

    const brevoData = await brevoResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        message: "Application notification email dispatched successfully.",
        messageId: brevoData.messageId || "sent",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    console.error("[send-application-email] Unhandled exception occurred.");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal error processing application email notification.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
