# Enterprise Safety HSE Management System

Upgraded to a modular enterprise stack with:

- React + Tailwind + Framer Motion + Recharts frontend (`admin-panel`)
- Node.js + Express + MongoDB backend (`backend/src`)
- JWT access/refresh token authentication
- RBAC + module permissions
- Work approvals, hazards, training, reports, settings, and notifications APIs
- Cloudinary-ready upload pipeline with local fallback
- Security middleware: Helmet, rate limiting, HPP, sanitize, CSRF guard, cookie security

## Backend Setup

1. Copy `.env.example` to `.env`
2. Fill MongoDB Atlas + JWT + Cloudinary values (`BACKEND_PUBLIC_URL` required for upload URLs)
3. Install dependencies
4. Start API

```bash
npm install
npm run dev
```

API base URL: `http://localhost:5000/api/v1`

Admin bootstrap endpoint has been removed for production security.
Create your first admin user manually in MongoDB (or via secure internal seed process),
then use authenticated admin APIs for further user creation.

## Frontend Setup

1. Copy `admin-panel/.env.example` to `admin-panel/.env`
2. Set `REACT_APP_API_URL` to backend API URL
3. Install + run frontend

```bash
cd admin-panel
npm install
npm start
```

## Deployment

- Backend: Render Web Service pointing to root `server.js`
- Frontend: Vercel project pointing to `admin-panel`
- Ensure `FRONTEND_URL` and `REACT_APP_API_URL` match deployed origins
- `admin-panel/vercel.json` includes SPA rewrite for deep-link refresh support

## Enterprise Modules Included

- Dashboard KPI + analytics cockpit
- User management with role and session governance
- Work approval workflow with timeline and digital signatures
- Hazard risk matrix and closure workflow with evidence
- Training portal and progress tracking
- Reporting and export (CSV / Excel / PDF client-side)
- Company profile, branding, and security settings
- Notification center with unread counts and browser alerts

## Assigned Work Approval Workflow

Work approvals use named, stage-specific assignments. A creator, including a Supervisor, must assign one active eligible checker when submitting work. The assigned checker records findings and assigns an active Safety Manager. That Safety Manager records a recommendation and assigns an active Project Manager or Maintenance Manager for final approval. Only the assigned user can act at each stage; the creator remains view-only for check, recommendation, and approval actions.

Eligible assignees are loaded from `GET /api/v1/users/eligible-assignees?stage=check|recommendation|finalApproval`. The endpoint is authenticated, returns active users only, and supports `search`, `excludeUserId`, and comma-separated `excludeUserIds` filters. Administrators can reassign the current stage through `POST /api/v1/work-approvals/:id/reassign/:stage`; a reason is mandatory and the change is added to the audit trail and workflow timeline.

Workflow notifications and email are sent directly to the named assignee. Returned work is sent directly to the creator. Older unassigned records remain readable, but an administrator must assign an eligible user before the pending workflow action can continue.

## Official Work Report

The Work Report PDF and Excel exports share one fixed 16-column schema: Approval No, Date, Work Type, Location, Requested Chainage, Approved Chainage, Completed Chainage, Completion %, Workers, Created By, Created Role, Workflow Stage, Checked By, Recommended By, Approved By, and Status. PDF output is A4 landscape with repeated red headers and page footers; Excel output includes report metadata, applied date range, filters, column widths, and a frozen header row.
