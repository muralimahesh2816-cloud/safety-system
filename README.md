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
# Google Maps location configuration

The Work Approval and Hazard forms load Google Maps only when a location card is expanded. Configure `REACT_APP_GOOGLE_MAPS_API_KEY` and `REACT_APP_GOOGLE_MAP_ID` in the admin-panel environment. Enable Maps JavaScript API and Geocoding API in the Google Cloud project, attach billing, restrict the browser key by the deployed HTTP referrers, restrict it to the Maps JavaScript API, and configure quota alerts. Keep server-side reverse-geocoding credentials separate and never expose them through a `REACT_APP_` variable.

When Maps is unavailable or unconfigured, the UI keeps the address and coordinate fields usable and provides a safe external Google Maps link. Existing records without coordinates continue to render as legacy address-only locations.
