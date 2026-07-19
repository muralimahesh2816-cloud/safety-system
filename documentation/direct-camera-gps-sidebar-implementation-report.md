# Direct Camera Capture, GPS-Stamped Media, and Smart Sidebar

## Implementation summary

The Safety Management System now uses one shared media-capture workflow for Work Approvals and Hazard reporting. Users can take a photo, record a video, or select files from the gallery. Browser geolocation is explicitly opt-in, requested only during capture, and handled without blocking optional-policy submissions when permission or positioning is unavailable.

Captured images receive a non-destructive visible evidence panel before upload. Videos retain the original recording and receive a stamped poster frame plus structured metadata for the player overlay. The backend stores normalized media assets, validates all client metadata, never treats browser-provided coordinates as verified, redacts exact coordinates for unauthorized viewers, and includes authorized location details in report exports.

The desktop sidebar now defaults to collapsed, expands on hover or keyboard focus, can be locked open, and stores only the user's lock preference. Mobile navigation remains tap-controlled and dismissible with Escape.

## Files added

- `admin-panel/src/hooks/useSidebarPreference.js` — single persistence boundary for the sidebar lock preference.
- `documentation/direct-camera-gps-sidebar-implementation-report.md` — this implementation and deployment report.

The shared capture, location, stamping, asset-schema, environment, and model files already existed in the repository index and were completed or reused by this implementation:

- `admin-panel/src/components/media/DirectMediaCapture.jsx`
- `admin-panel/src/hooks/useDeviceLocation.js`
- `admin-panel/src/utils/GpsImageStamp.js`
- `backend/src/utils/media-metadata.js`

## Files changed

### Frontend capture and upload

- `admin-panel/src/pages/WorkApprovalsPage.jsx`
- `admin-panel/src/components/modals/WorkApprovalDetailsModal.jsx`
- `admin-panel/src/pages/HazardsPage.jsx`
- `admin-panel/src/api/services.js`
- `admin-panel/src/components/common/MediaStudioModal.jsx`
- `admin-panel/src/components/media/DirectMediaCapture.jsx`

These changes replace raw evidence pickers with the shared three-action workflow, preserve photo/video separation, serialize per-file metadata, upload video thumbnails, provide preview/remove/retry states, and display evidence metadata consistently in the media viewer.

### Sidebar and accessibility

- `admin-panel/src/App.js`
- `admin-panel/src/components/layout/Sidebar.jsx`
- `admin-panel/src/components/layout/Topbar.jsx`
- `admin-panel/src/components/login/LoginPanel.jsx`
- `admin-panel/src/components/login/LoginPanel.test.jsx`
- `admin-panel/package.json`

These changes establish one active sidebar state owner, hover/focus expansion on pointer-capable desktop devices, a native lock toggle, mobile menu accessibility, and a repository lint command. The sign-in and verification forms now have accessible names.

### Backend media, privacy, and reporting

- `backend/src/routes/work.routes.js`
- `backend/src/routes/hazards.routes.js`
- `backend/src/routes/reports.routes.js`
- `backend/src/utils/media-metadata.js`
- `backend/tests/production-readiness.test.js`

Work and Hazard routes now ingest structured media metadata and video posters, apply environment-based GPS policy, attach audit events, and redact asset locations before serialization. Report exports include one normalized row per evidence asset and expose latitude/longitude only to authorized roles or related users.

### Configuration

- `.env.example`
- `backend/.env.example`
- `admin-panel/.env.example`

## Files removed

- `admin-panel/src/components/layout/AppShell.jsx` — unused legacy shell containing a second sidebar state owner and the obsolete `sidebarCollapsed` storage key.

Existing routes, pages, and stored-media compatibility were preserved.

## Architecture decisions

### One capture component

`DirectMediaCapture` owns the three input modes and returns ordinary `File` objects with attached `evidenceMetadata`. API services translate those files into multipart fields. This keeps Work Approvals and Hazards behavior consistent without coupling their business forms.

### Location lifecycle

Geolocation uses a single high-accuracy request with a 12-second timeout and a 30-second maximum cached age. No location watcher is started. Coordinates remain in component memory until submission, then become evidence metadata. Permission denial, insecure contexts, unsupported browsers, timeouts, and low accuracy have explicit UI states.

### Watermarking strategy

Images are rendered through Canvas into a new upload blob; source descriptors remain in metadata. Videos are not transcoded in-browser: the original video is uploaded, a Canvas-stamped poster frame is uploaded separately, and the media viewer displays the permanent structured overlay. This avoids fragile client-side video encoding while retaining evidentiary context.

### Trust boundary and privacy

The server validates ranges, timestamps, accuracy, source enums, and media fields. It forces `locationSource` to `browser_geolocation` and `isVerified` to `false`; client claims cannot elevate evidence trust. Exact coordinates are limited to Admin, Safety Officer, Super Admin, the record creator, and the relevant assignee. Other users receive a recorded/not-recorded indication without precise values.

### Maps and reverse geocoding

Coordinates are always the dependency-free fallback. `MAP_PROVIDER`, `REVERSE_GEOCODING_PROVIDER`, and related server-side variables provide an extension point for provider integration. Provider keys are never sent to the browser. No external provider is required for capture, storage, viewing, or reporting.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `REACT_APP_GPS_EVIDENCE_POLICY` | frontend | UI policy hint: `optional`, `required`, or `off`. |
| `REACT_APP_MAX_ACCEPTABLE_GPS_ACCURACY_METERS` | frontend | Accuracy warning threshold. |
| `GPS_EVIDENCE_POLICY` | backend | Authoritative enforcement policy. |
| `MAX_ACCEPTABLE_GPS_ACCURACY_METERS` | backend | Server accuracy threshold. |
| `MEDIA_RETENTION_DAYS` | backend | Retention configuration for operations tooling. |
| `MAP_PROVIDER` | backend | Optional map-provider selector. |
| `MAP_API_KEY` | backend | Server-only provider credential. |
| `REVERSE_GEOCODING_PROVIDER` | backend | Optional reverse-geocoder selector. |
| `REVERSE_GEOCODING_API_KEY` | backend | Server-only reverse-geocoder credential. |

## Test results

- Backend production-readiness suite: 11 tests passed.
- Frontend suite: 18 tests passed using the single-process CI-compatible runner.
- Frontend production build: compiled successfully.
- Production frontend lint: passed.
- Backend syntax checks: passed for all changed route and utility files.
- Build emitted the existing bundle-size advisory; it is not a functional failure.

Automated browser initialization was unavailable in the local Codex browser runtime, so physical camera, permission-prompt, and responsive interaction testing must still be completed on staging. The implementation uses standards-based capture and geolocation APIs and preserves gallery fallback behavior.

## Deployment notes

1. Serve production and staging over HTTPS. Camera and geolocation can be unavailable in non-secure contexts outside localhost.
2. Choose the backend `GPS_EVIDENCE_POLICY` first; treat the frontend value as explanatory UI only.
3. Confirm reverse-proxy request-size limits accommodate the configured photo/video limits.
4. Ensure the upload provider accepts poster-image fields and preserves existing media URLs.
5. Keep map and reverse-geocoding credentials server-side. Restrict them by API, origin or server egress, and quota where the provider supports it.
6. Validate role mappings for Admin, Super Admin, Safety Officer, record creator, and assignee before enabling exact coordinates in production reports.
7. Run a staging device matrix: Android Chrome, iOS Safari, desktop Chrome, desktop Edge, plus permission allowed, denied, unavailable, timed-out, and low-accuracy cases.
8. Verify existing records that contain legacy string URLs continue to render before rollout.

## Known limitations and future improvements

- Browser APIs cannot prove that coordinates represent the true physical capture location; browser location is deliberately stored as unverified evidence.
- Direct camera launch behavior is controlled by each browser and device. Desktop browsers may present a file/device picker instead of a full camera UI.
- Video evidence uses an original file plus stamped poster and player overlay, not burned-in frame-by-frame transcoding. Server-side FFmpeg processing can be added if policy requires an immutable overlay throughout playback.
- Reverse-geocoded addresses and embedded map snapshots require a chosen provider implementation; raw coordinates remain fully functional without one.
- Retention configuration is present, but irreversible cleanup should be implemented as a separately reviewed scheduled job with legal-hold support.
- The physical-device and assistive-technology matrix remains a staging release gate.
