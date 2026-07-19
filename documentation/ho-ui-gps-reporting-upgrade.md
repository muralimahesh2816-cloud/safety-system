# HO UI, GPS, Reporting, And Login Upgrade

## Executive Summary

The requested HO-level upgrade is implemented across the React admin panel and Node/Express API. It standardizes the product name as **Safety Management System**, makes the full top bar dashboard-only, retains a compact mobile menu on inner modules, adds one desktop sidebar lock control, captures and persists GPS metadata with server-side reverse geocoding, exports A4 work/hazard reports, and replaces the login illustration with a lightweight SCSS road scene. Existing authentication, role gates, Cloudinary/local media storage, and workflow transitions remain intact.

## Audit And Architecture Decisions

- Reused the active `App`, layout, modal, API-service, media-normalization, and PDF-export paths instead of creating a parallel shell.
- Removed unused duplicate legacy pages, sidebars, dashboard, login, and obsolete illustration files after confirming they had no active imports.
- Kept raw media uploads as files/URLs; no Base64 payload is stored in MongoDB.
- Kept reverse-geocoding credentials and provider calls on the backend.
- Preserved graceful degradation: camera, location, geocoding, video preview, and external map actions each fail independently.

## UI Shell And Navigation

The full `Topbar` now renders only on Dashboard. Work Approvals, Hazards, Reports, Training, Users, Settings, and System Health use a shared `PageHeader` containing brand, module title, breadcrumb, and optional actions/status. On small screens, inner modules retain a single menu trigger so navigation remains reachable.

The desktop sidebar expands on hover/focus and can be held open by one persisted lock checkbox. The prior duplicate expand/collapse control is removed. The mobile drawer has one close button and preserves the same navigation and role filtering.

## Branding

The canonical product name is `Safety Management System`, sourced from `admin-panel/src/config/appConfig.js` in the client and `APP_NAME` in backend configuration. It is used for document titles, public metadata, navigation, login, PDF output, notification/email copy, API health identity, and GPS image stamps. Company identity remains independently configurable and is not overwritten by product branding.

## Direct Camera And Media Capture

The shared `DirectMediaCapture` component supports direct photo and video acquisition, gallery/file fallback, previews, retry/removal, validation, and batch submission. Work-before, work-completion, and hazard evidence retain their existing workflow gates. Each selected batch shares one location capture to avoid redundant permission prompts and provider calls.

## GPS Capture And Complete Address

The browser requests geolocation with high accuracy, a 15-second timeout, and a 15-second maximum age. Stored metadata can include latitude, longitude, horizontal accuracy, altitude, capture time, structured address fields, formatted address, provider, reverse-geocoding status, and resolution time.

`POST /api/location/reverse-geocode` validates coordinate ranges, applies an authenticated server-side provider request with an abort timeout, and normalizes generic, Google, Mapbox, and Nominatim-style results. If permission is denied, the device cannot resolve a position, the provider times out, or no provider is configured, media capture remains usable. Valid coordinates are preserved and the address becomes `Address unavailable` when appropriate.

The location card shows address, coordinates, accuracy, capture time, and status. Users can retry GPS, refresh the address, open coordinates in a map, or remove location before submission. A latitude of zero is treated as valid.

## Privacy And Security

- Reverse-geocoding API keys remain server-only and are never logged.
- Operational logs contain request/record identifiers, provider/status, durations, and media counts, but omit coordinates, full addresses, OTPs, and secrets.
- Existing exact-location redaction now removes both coordinates and structured/formatted address fields.
- Address strings are length-bounded and control characters are removed before persistence.
- Production must select a provider whose licensing, attribution, privacy, regional-transfer, and retention terms meet organizational policy.

## GPS Image Stamp

The image stamp includes the product name, wrapped address, six-decimal coordinates, accuracy, capture timestamp, user/reference context, and a restrained translucent panel. The panel adapts to long address text while preserving the source image aspect ratio. Video metadata remains associated with the video rather than rasterizing the file.

## A4 PDF Reporting

Work Approval and Hazard detail exports use A4 portrait pages with consistent margins, headers, footers, page numbers, identity fields, workflow data, timelines, media evidence, and location metadata where authorization permits it. Long content wraps; tables and description blocks paginate without overlap. Images fit inside bounded evidence areas while keeping their aspect ratio. Video evidence uses a thumbnail when available and otherwise emits a secure text link/reference.

A representative four-page Work Approval fixture was generated from the real exporter, checked with PDF metadata tools, rendered to PNG, and visually inspected. It measured 595.28 × 841.89 points (A4), with clean margins, wrapped long content, stable page breaks, and no visible clipping or overlap.

## Login Road Animation

The old illustration was replaced by a decorative DOM/SCSS scene containing perspective road lanes, hills, barriers, streetlights, a safety sign, and moving vehicle lights. Animation uses transform and opacity, is hidden from assistive technology, respects `prefers-reduced-motion`, and simplifies detail on smaller/low-motion devices. Authentication, OTP, recovery, validation, and submission behavior were not changed. Sass is now an explicit development dependency.

## Backend Data And API Changes

- Added `backend/src/services/location.service.js` and `backend/src/routes/location.routes.js`.
- Expanded normalized media location fields in `backend/src/utils/media-metadata.js`.
- Mounted the authenticated location endpoint in the API route index.
- Added safe media-save and report-duration telemetry.
- Applied canonical branding to app/server health, email, and notification services.
- Removed development OTP value logging.

No MongoDB migration is required because location metadata remains optional and additive within existing media objects. Existing records without these fields remain valid.

## Frontend Changes

- Added shared `PageHeader` and `MediaLocationCard` components.
- Added reverse-geocoding API integration and richer device-location metadata.
- Updated work/hazard details to preserve complete media metadata.
- Updated report and stamp generators to consume the normalized location object.
- Added the SCSS road scene and centralized product branding.
- Deleted confirmed unused legacy components and assets.

## Configuration And Deployment

Set `APP_NAME` on the backend and `REACT_APP_APP_NAME` before building the frontend if a non-default name is required. Configure `REVERSE_GEOCODING_API_URL`, `REVERSE_GEOCODING_PROVIDER`, `REVERSE_GEOCODING_API_KEY`, and optionally `REVERSE_GEOCODING_TIMEOUT_MS` in Render or the HO server environment. Do not place the provider key in the React environment.

The geocoding URL supports `{lat}`, `{lng}`, and `{key}` placeholders. If placeholders are absent, the service sends a JSON POST containing latitude and longitude and uses a bearer key when configured. HTTPS is recommended. Keep the URL unset when address resolution is intentionally disabled; coordinate capture continues to work.

For Render, update backend environment variables and redeploy the service, then rebuild/redeploy the static frontend for any `REACT_APP_` changes. For an HO-hosted server, update the service manager's environment, restart the backend, rebuild the React bundle, and verify the configured frontend/backend origins and HTTPS geolocation permissions.

## Validation And Test Coverage

Automated coverage includes provider normalization, invalid coordinates, provider-unavailable fallback, exact-location redaction, device-location options/results, page-header semantics, dashboard-only topbar behavior, inner-page document titles, mobile menu availability, and absence of duplicate sidebar controls. Existing backend and frontend suites remain part of the final verification, along with lint, production build, backend syntax checks, and whitespace validation.

The in-app browser connection could not initialize in this environment, so interactive physical-device checks were not simulated with a standalone browser. Camera permissions, GPS accuracy, provider response/attribution, hover/focus behavior, mobile drawers, reduced motion, and authenticated workflow submission should be exercised in staging on representative Android, iOS, desktop, and HO-network devices before release.

## Release Checklist

1. Configure the server-only reverse-geocoding provider and review its legal/privacy terms.
2. Confirm HTTPS and CORS origins for the production frontend and backend.
3. Test camera and GPS permission accept/deny/retry flows on physical devices.
4. Verify exact-location visibility for every production role and exported report.
5. Exercise work-before, work-completion, and hazard evidence submissions end to end.
6. Inspect image/video evidence and long-address A4 exports using representative production data.
7. Validate keyboard sidebar focus, mobile navigation, and reduced-motion behavior.
8. Monitor geocoding timeout/error rates, media upload failures, and report durations after rollout.

## Rollback

The change is additive and source-controlled. A normal application rollback restores the prior frontend/backend version; no database rollback is needed. Existing richer media metadata is ignored by older code. If only the geocoder needs disabling, remove `REVERSE_GEOCODING_API_URL`; captures will retain coordinates and show `Address unavailable` without disabling media submission.
