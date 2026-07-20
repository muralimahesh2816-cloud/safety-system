# Evidence-Only GPS and Form Layout Cleanup

## Summary

Standalone Google Maps cards and manual coordinate editors were removed from Work Approval and Hazard create, edit, detail, completion, and closure views. GPS remains opt-in and attached only to each selected image or video. Media selection, camera capture, gallery upload, evidence stamping, reverse geocoding, uploads, database metadata, PDFs, authentication, and workflows remain intact.

## Removed

- `LocationMapCard.jsx`
- `googleMapsLoader.js`
- Frontend location-map utilities and their tests
- All Work/Hazard map imports, map state, coordinate editors, marker/search controls, embedded map warnings, and map-specific SCSS
- Frontend Google Maps and Map ID environment variables
- Unused record-location update service calls from active forms

No Google Maps package had been installed, so no package dependency needed removal. `REACT_APP_GOOGLE_MAPS_API_KEY`, `REACT_APP_GOOGLE_MAP_ID`, and frontend default-map variables are no longer required.

## Retained

- Per-media latitude, longitude, accuracy, capture time, address, permission status, capture source, location source, and reverse-geocode status
- Opt-in `Include capture location` control
- GPS requests only after media selection/capture or explicit retry
- Backend reverse-geocoding endpoint and server configuration
- Existing record-level `geoLocation` data and audited endpoints for backward compatibility; these fields are deprecated in active Work/Hazard forms and are not displayed or edited there
- Evidence GPS blocks in detail PDFs

## Evidence preview

Each file now uses one responsive corporate card with a 16:9 image or video-poster preview, wrapped filename, source/type/upload-state badges, file size, per-item location status, address, six-decimal coordinates, accuracy, captured time, external `Open Location`, retry, Preview, and Remove actions. Videos are not instantiated as active players in the form grid; the player opens only in the preview dialog.

The preview grid uses `auto-fit` with a safe 320px target and collapses to one column in compact and mobile contexts. Cards and their children use full-width/min-width safeguards, wrapped text, and 44px action targets.

## Details and reports

Work and Hazard detail modals show read-only `MediaLocationCard` metadata directly below the relevant before/after evidence preview. PDFs continue to place compact address, coordinates, accuracy, and capture-time information with evidence and never contain map controls or API errors.

## Deployment

Redeploy the frontend after a successful production build. No frontend Google Maps key is needed. Retain backend reverse-geocoding variables if evidence addresses should resolve. No database migration or destructive data cleanup is required.
