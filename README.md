
# Prove Talentbridge

Prove Talentbridge is a professional freelance marketplace that connects clients with skilled professionals across different industries.

## Project Purpose

The platform allows clients to discover professionals, post projects and communicate with service providers.

Professionals can create profiles, select an occupation, discover relevant opportunities and submit completed work for review.

## Main Features

- Client and professional registration
- Professional login
- Marketplace and professional profiles
- Job posting and project management
- Client and professional dashboards
- Separate chat pages
- Work submission and verification
- Admin and staff management
- Payment request and review pages
- Premium membership
- Notifications and support
- Dispute management
- Terms, privacy and payment policies

## Project Structure

```text
Prove-Talentbridge/
│
├── index.html
├── README.md
│
├── assets/
│   └── logo.png
│
├── style.css
│
├── js/
│   ├── admin.js
│   ├── auth.js
│   ├── chat.js
│   ├── dashboard.js
│   ├── jobs.js
│   ├── main.js
│   ├── notifications.js
│   ├── payments.js
│   ├── supabase.js
│   └── verification.js
│
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   └── review-payment/
│   │       └── index.ts
│   └── migrations/
│       └── 20261113090000_manual_payments.sql
│
└── pages/
    ├── admin.html
    ├── admin-verification.html
    ├── chat.html
    ├── chat-client.html
    ├── chat-worker.html
    ├── client-dashboard.html
    ├── community-rules.html
    ├── dashboard.html
    ├── disputes.html
    ├── forgot-password.html
    ├── job-posting.html
    ├── login.html
    ├── marketplace.html
    ├── notifications.html
    ├── payments.html
    ├── payments-policy.html
    ├── payout-requests.html
    ├── premium.html
    ├── privacy.html
    ├── professional-dashboard.html
    ├── professional-profile.html
    ├── project-management.html
    ├── project-offers.html
    ├── register.html
    ├── staff.html
    ├── staff-management.html
    ├── support.html
    ├── terms.html
    └── worker-tasks.html
```

## Technology

- HTML
- CSS
- JavaScript
- Supabase Auth, Postgres, private Storage and Edge Functions (project configuration required)

## Business Model

- Platform service fee: 5%
- Monthly Premium: ₦1,500
- Six-month Premium: ₦7,500
- Yearly Premium: ₦15,000

## Development Status

This project is under development.

Authentication and payment flows use Supabase when configured. Project, chat and other non-payment demo flows may still use browser `localStorage`; that data is local to one browser and is not shared with other users or devices.

## Supabase Manual Payments Setup

1. Put your Supabase project URL and **publishable** key in `js/supabase.js`. Never put a secret or service-role key in browser code.
2. Apply `supabase/migrations/20261113090000_manual_payments.sql` to your project.
3. Sign up the Admin account, then add its Auth user UUID to `public.admin_users` using the Supabase SQL Editor. Do not let users assign themselves Admin access.
4. Set the `ALLOWED_ORIGIN` Edge Function secret to the exact deployed website origin.
5. Deploy `supabase/functions/review-payment` with `supabase functions deploy review-payment`.
6. Add the deployed site URL to Supabase Auth's allowed redirect URLs and serve the site over HTTP(S), not `file://`.

The migration enables row-level security, keeps receipt objects private, limits Premium prices server-side, and restricts payment confirmation to the Admin Edge Function. Receipts and payout requests are visible only to the client who submitted them and authorized Admin users. Payouts and refunds are not automatically transferred or issued.

The browser can be configured before the Supabase project is available, but live authentication, uploads, Admin review and notifications are not active until the setup above is completed and tested.

## Important Security Notice

Browser localStorage is only suitable for demonstrations and temporary testing.

Production accounts, passwords, payments, private messages and staff permissions must be handled securely through the backend.

Never expose a Supabase secret or service_role key in frontend JavaScript.

## Hosting

The project can be hosted using GitHub Pages for static website testing.

A backend service such as Supabase is required for real user accounts, shared data and protected platform operations.

## Project Name

Prove Talentbridge
