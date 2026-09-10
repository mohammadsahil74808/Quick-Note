# DEV MAVERICKS — Brevo Transactional Email & Supabase Edge Function Setup Guide

> **Phase 4B Architecture**: Serverless Email Dispatch via Supabase Edge Functions (`send-application-email`) + Brevo Transactional Email API (v3)

---

## 🏗️ Architecture & Email Workflows

```
                           ┌────────────────────────────────────────────────────────┐
                           │               DEV MAVERICKS FRONTEND                  │
                           └────────────────────────────────────────────────────────┘
                                    │                                 │
           (Flow 1: New Application)│                                 │ (Flow 2 & 3: Admin Review)
                                    ▼                                 ▼
                     [ Join Us Portal: join.html ]      [ Admin Panel: admin.html ]
                                    │                                 │
                                    │                                 │ approveApplication() / rejectApplication()
                                    ▼                                 ▼
                     [ Supabase PostgreSQL ] ──────────► [ Atomic PostgreSQL RPC ]
                     (applications table)               (approve_application / reject_application)
                                    │                                 │
                                    │                                 │ DB update succeeded + member created
                                    ▼                                 ▼
                     ┌──────────────────────────────────────────────────┐
                     │ Supabase Edge Function: send-application-email   │
                     │ (Deno Serverless Runtime, Deno.env secrets)      │
                     └──────────────────────────────────────────────────┘
                                             │
                                             ▼
                     ┌──────────────────────────────────────────────────┐
                     │   Brevo Transactional Email API (v3)             │
                     │   Endpoint: POST https://api.brevo.com/v3/smtp/email│
                     └──────────────────────────────────────────────────┘
                                    │                                 │
          (action: admin_new_application)    (action: applicant_approved / applicant_rejected)
                                    ▼                                 ▼
                 [ Club Admin Notification Inbox ]      [ Applicant's Personal Email Inbox ]
```

### Supported Email Actions

| Action Type | Trigger Event | Recipient | Subject Line |
| :--- | :--- | :--- | :--- |
| `admin_new_application` | Student submits Join Us form (`join.html`) | `APPLICATION_NOTIFICATION_EMAIL` (Club Admin) | `New DEV MAVERICKS Membership Application` |
| `applicant_approved` | Admin clicks **Approve** in Admin Panel (`admin.html`) | `applications.email` (Applicant) | `Your DEV MAVERICKS Membership Application Has Been Approved` |
| `applicant_rejected` | Admin clicks **Reject** in Admin Panel (`admin.html`) | `applications.email` (Applicant) | `Update on Your DEV MAVERICKS Membership Application` |

---

## 🛡️ Key Security & Resilience Guarantees

1. **Zero Secret Exposure**:
   * The `BREVO_API_KEY` is a **private server-side secret**.
   * It is **never** included in HTML, CSS, client-side JavaScript (`scripts/supabase.js`, `scripts/admin.js`, `scripts/main.js`), public Git commits, or client-accessible environment variables.
   * It is stored strictly inside Supabase's encrypted Edge Function secrets vault (`Deno.env.get("BREVO_API_KEY")`).
2. **Strict RLS Intact**:
   * Applications table remains protected by Row Level Security (RLS). Public users can only insert applications with `status = 'pending'`. Only verified admins can read applications or update their status.
3. **Non-Blocking Operation**:
   * If Brevo encounters an error (network outage, unverified sender, or quota limit), the core database operation **remains 100% successful**.
   * Applications are never rolled back or deleted if an email fails to dispatch.
   * Member creation during approval is preserved.
4. **Duplicate Protection**:
   * In-flight submission and click locks (`processingAppIds` in `admin.js` and `isSubmitting` in `main.js`) prevent double-clicks.
   * PostgreSQL RPC row-level locking (`FOR UPDATE`) and status validation prevent re-approving or re-rejecting already-reviewed applications.

---

## 📋 Required Supabase Edge Function Secrets

The `send-application-email` Edge Function requires the following 4 environment secrets:

| Secret Name | Description | Example / Format |
| :--- | :--- | :--- |
| `BREVO_API_KEY` | Your private Brevo v3 Transactional API key | `xkeysib-...` |
| `APPLICATION_NOTIFICATION_EMAIL` | Admin recipient email address for new application notifications | `sahilansari74808@gmail.com` |
| `BREVO_SENDER_EMAIL` | A verified sender email address configured inside your Brevo account | Your verified Brevo sender email |
| `BREVO_SENDER_NAME` | The outgoing sender display name | `DEV MAVERICKS` |

---

## 🛠️ Step-by-Step Configuration Guide

### Step 1: Verify Sender in Brevo

1. Log in to your [Brevo Dashboard](https://app.brevo.com/).
2. In the top-right corner, click your **Account Name** and select **Senders, Domains & Dedicated IPs** (or go to [Senders & IP](https://app.brevo.com/senders)).
3. Click **"Add a Sender"**.
4. Enter:
   * **Sender Name**: `DEV MAVERICKS`
   * **Sender Email**: The email address you will use for dispatching club emails (e.g. personal Gmail during testing or official club address).
5. Open that inbox and click Brevo's confirmation link. Brevo will mark the sender status as **Verified**.
   > ⚠️ **Critical**: Brevo rejects email dispatch if the sender email has not been verified.

---

### Step 2: Retrieve Your Brevo API Key

1. In Brevo Dashboard, click your account name in the top-right and select **SMTP & API** (or go to [API Keys](https://app.brevo.com/settings/keys/api)).
2. Click **"Generate a new API key"**.
3. Name your key: `dev-mavericks-edge-function`.
4. Copy the generated key (starts with `xkeysib-...`).
   > 🔒 **Security Notice**: Never paste this key into source code or chat windows.

---

### Step 3: Configure Secrets in Supabase

#### Option A: Via Supabase Web Dashboard (Recommended)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings → Edge Functions → Secrets** (or select **Edge Functions** in the left sidebar and click **Secrets**).
3. Click **"Add new secret"** for each of the 4 secrets:
   * `BREVO_API_KEY` = `your_brevo_api_key`
   * `APPLICATION_NOTIFICATION_EMAIL` = `your_personal_or_admin_email@example.com`
   * `BREVO_SENDER_EMAIL` = `your_verified_sender_email@example.com`
   * `BREVO_SENDER_NAME` = `DEV MAVERICKS`
4. Click **Save**.

#### Option B: Via Supabase CLI

```bash
npx supabase secrets set BREVO_API_KEY=your_key APPLICATION_NOTIFICATION_EMAIL=your_email BREVO_SENDER_EMAIL=your_sender BREVO_SENDER_NAME="DEV MAVERICKS"
```

---

### Step 4: Deploy the Edge Function

Deploy the updated `send-application-email` Edge Function from your local workspace:

```bash
npx supabase login
npx supabase link --project-ref ybrgsgyecxbotfttihld
npx supabase functions deploy send-application-email --no-verify-jwt
```

> **Why `--no-verify-jwt`?**: This flag allows public applicants submitting the Join Us form (`join.html`) to invoke the function without an active user session token. The function validates inputs internally.

---

## 🔍 Where to Check Supabase Edge Function Logs

When testing or diagnosing email dispatch:
1. In the [Supabase Dashboard](https://supabase.com/dashboard), navigate to **Edge Functions**.
2. Click on the **`send-application-email`** function.
3. Click on the **"Logs"** (or **Invocations**) tab.
4. You will see real-time logs of incoming requests, HTTP status codes, and dispatch confirmation:
   * Status `200`: Email successfully accepted by Brevo API.
   * Status `400`: Missing required payload field (e.g. missing applicant email).
   * Status `500`: Missing environment secret in Supabase Vault.
   * Status `502`: Brevo API rejected the dispatch (e.g. unverified sender address).
   *(Notice: All error logs are strictly sanitized and never output private API keys or auth headers).*

---

## 🧪 Comprehensive Verification Checklist

### Test 1: New Application Notification (Flow 1)
1. Navigate to `http://localhost:3000/join.html`.
2. Fill out and submit the application form.
3. **Verify**:
   * Form displays the success screen.
   * Supabase `applications` table receives the new row with `status: 'pending'`.
   * The inbox configured in `APPLICATION_NOTIFICATION_EMAIL` receives the notification email with subject:
     `New DEV MAVERICKS Membership Application` containing the applicant's details and links.
   * The applicant does **not** receive an approval email at this stage.

### Test 2: Admin Approval Notification (Flow 2)
1. Navigate to `http://localhost:3000/admin.html` and sign in.
2. Under Applications, locate the pending applicant and click **"✓" (Approve)** or open the modal and click **"Approve Application"**.
3. **Verify**:
   * Application status updates to `approved`.
   * A new row is created in `public.members` with `active: true`.
   * The applicant's email address receives the acceptance email with subject:
     `Your DEV MAVERICKS Membership Application Has Been Approved`.
   * Public Team page (`http://localhost:3000/team.html#members-section`) shows the newly approved member.

### Test 3: Admin Rejection Notification (Flow 3)
1. Submit another test application on `join.html`.
2. In `admin.html`, locate the application and click **"✕" (Reject)**.
3. **Verify**:
   * Application status updates to `rejected`.
   * No member record is created in `public.members`.
   * The applicant receives the cohort update email with subject:
     `Update on Your DEV MAVERICKS Membership Application`.

### Test 4: Fault Tolerance Test (Simulated Failure)
1. Temporarily unset or use an unverified sender in `BREVO_SENDER_EMAIL`.
2. Submit an application or approve one.
3. **Verify**:
   * The database submission or approval completes normally.
   * The frontend shows a normal success message and safely logs a warning to the developer console.
   * No API key, token, or sensitive data is logged.
