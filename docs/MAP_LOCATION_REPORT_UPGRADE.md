# Map, Location and Report Upgrade - Implementation Report

## Executive summary

The portal now uses one lazily loaded Google Maps integration and one `LocationMapCard` across Work Approval and Hazard create, edit, detail, completion and closure contexts. Record GPS is normalized, reverse-geocoded by the backend, permission protected, and retained with a mandatory-reason correction audit. Existing text-only and media-GPS records remain readable. Report tables use a reduced A4-safe column set and detail PDFs include canonical GPS fields.

## Audit findings

- Active frontend: Create React App in `admin-panel`; therefore browser variables use `REACT_APP_`.
- Active record screens: `WorkApprovalsPage.jsx`, `HazardsPage.jsx`, `WorkApprovalDetailsModal.jsx`, and `HazardDetailsModal.jsx`.
- Existing location facilities reused: `useDeviceLocation`, media evidence metadata, `locationService`, and `POST /api/location/reverse-geocode`.
- No Google Maps wrapper was installed. A minimal singleton loader avoids adding a competing dependency.
- Active PDFs use jsPDF and AutoTable through `pdfExport.js`, `detailPdfExport.js`, and shared `pdfDesign.js`.
- Historical login copy was recovered from Git revision `becd06f6`; it was not rewritten.
- The supplied portal reference was treated only as a high-level interaction reference; protected content was not scraped.

## Restored login copy

- Main title: `Building a Safer Workplace, Together`
- Supporting text: `Manage work approvals, hazard reporting, training records, and safety actions through one secure enterprise platform.`
- Benefit titles: `Structured approvals`, `Timely safety updates`, and `Role-based access`
- The historical `Secure portal` badge and application title were restored without adding a second logo.

## Maps architecture and behavior

- `googleMapsLoader.js` loads Maps JavaScript API once, only after a map is expanded.
- `LocationMapCard.jsx` uses `google.maps.marker.AdvancedMarkerElement`; it does not use deprecated `google.maps.Marker`.
- Controls: roadmap/satellite, zoom, native drag/touch pan, fullscreen, recenter, current GPS, reset, coordinate entry, search, and minimize/expand.
- Marker drag and applied coordinates are reverse-geocoded with a 650 ms debounce for coordinate entry.
- Missing key, load failure, quota/network failure, absent coordinates, and reverse-geocode failure preserve usable text/coordinate controls.
- List cards do not instantiate maps.
- Compatibility priority: canonical `geoLocation`, legacy coordinate fields, evidence GPS, GeoJSON, then address-only fallback.

## Data, permissions and audit

- Canonical record field: `geoLocation`, using the shared location schema.
- Work location updates: creator correction during the returned workflow or administrator override; backend permission required.
- Hazard location updates: reporter/assignee while open, or administrator correction; closed records require administrator authority.
- Every persisted correction requires a reason and stores previous/new location, actor, role and timestamp in `locationAuditHistory`, plus a timeline and system audit event.
- Exact coordinates reuse the existing operational-role/record-owner visibility policy and are redacted for unrelated users.
- The server confirms coordinates and performs reverse geocoding instead of trusting a submitted address.

## Reports

- Work PDF table: Sl No., Work ID, Work Type, Location, Chainage, Created By, Status, Created Date, Completed Date.
- Hazard PDF table: Date, Plaza, Location/Chainage, Reported By, Category, Description, Action Team, Action Taken, Status.
- Long text is wrapped by AutoTable, headers repeat, landscape is selected only for wide tables, and shared headers/footers/page numbering remain active.
- Work Approval and Hazard detail PDFs include GPS address, coordinates, source and accuracy. No live map or private API key is embedded.
- A representative landscape page with a long address was rendered to PNG and visually checked after correcting the validation fixture; no overlap or clipping remained.

## Configuration and deployment

Frontend:

```text
REACT_APP_GOOGLE_MAPS_API_KEY=
REACT_APP_GOOGLE_MAP_ID=
REACT_APP_DEFAULT_MAP_LAT=13.494759
REACT_APP_DEFAULT_MAP_LNG=74.719246
REACT_APP_DEFAULT_MAP_ZOOM=18
```

Backend:

```text
GOOGLE_GEOCODING_API_KEY=
GOOGLE_GEOCODING_TIMEOUT_MS=10000
```

Enable Maps JavaScript API and Geocoding API with billing. Use separate development, staging and production keys. Restrict the browser key by allowed HTTP referrers and browser APIs. Restrict the server key by server IP and Geocoding API. Configure quota and budget alerts. Add the variables to Render, redeploy the backend and admin panel, then verify an authorized create/edit flow.

## Validation results

- Backend: 15/15 production-readiness tests passed.
- Frontend: 29/29 tests passed across 9 suites.
- Frontend production build: compiled successfully without warnings.
- Backend syntax checks: Work and Hazard routes passed.
- `git diff --check`: passed (only Windows line-ending notices).
- In-app interactive browser validation could not run because the desktop browser bridge failed to initialize. Chrome/Edge/Firefox and physical mobile geolocation remain release-environment checks.

## Files

Created: `LocationMapCard.jsx`, `googleMapsLoader.js`, `location.js`, `location.test.js`, and this report.

Modified: login page/styles; Work/Hazard pages and detail modals; API services; location/media metadata; Work/Hazard schemas and routes; PDF exporters; theme styles; environment examples; root README; backend readiness tests.

Removed: no active source files.
