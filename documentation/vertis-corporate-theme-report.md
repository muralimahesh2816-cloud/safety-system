# Vertis Corporate Theme, Login, And PDF Upgrade

## 1. Executive Summary

The active Safety Management System now uses one Vertis-derived red/charcoal design language across login, portal background, dashboard shell, navigation, cards, page headers, controls, Reports UI, and generated PDFs. The authentication request/OTP/recovery/session behavior was preserved. Work Approval, Hazard, Training, and summary PDF paths share A4 layout and brand constants and were rendered for visual QA.

## 2. Existing Login Problems

The prior active login was a two-column blue road scene with branding inside and outside the authentication card. It imported both a large legacy CSS file and road-scene SCSS, duplicated colors, used unrelated blue/cyan/orange accents, and did not use the full Vertis wordmark in the card.

## 3. Active Vertis Assets

- Full wordmark/logo: `admin-panel/src/assets/vertis-logo.svg`
- Rotating momentum asset: `admin-panel/src/assets/topbarlogo.svg`
- Wordmark SVG: `width="142"`, `height="58"`, `viewBox="0 0 142 58"`
- Momentum SVG: `width="893"`, `height="894"`, `viewBox="0 0 893 894"`
- Both assets use inline fills, with no SVG gradients or CSS variables.

## 4. Extracted Colors And Tokens

The sole SVG fill and source-of-truth Evolution Red is `#9B1400` (`155, 20, 0`). White text on this red is approximately 8.4:1. The lighter action gradient endpoint `#B82510` remains above 6:1 against white. Central tokens define primary/dark/light/soft red, warm accent, charcoal, surfaces, backgrounds, text, muted text, borders, semantic success/warning/danger, radii, shadows, focus ring, typography, and the shared portal background.

## 5. Files Created

- `admin-panel/src/styles/theme/_tokens.scss`
- `admin-panel/src/styles/theme/theme.scss`
- `admin-panel/src/pages/LoginPage.test.jsx`
- `admin-panel/src/utils/pdfDesign.js`
- `admin-panel/src/utils/pdfDesign.test.js`
- `documentation/vertis-corporate-theme-report.md`

## 6. Files Modified

- `admin-panel/src/index.js`
- `admin-panel/src/pages/LoginPage.jsx`
- `admin-panel/src/components/login/LoginPanel.jsx`
- `admin-panel/src/styles/login/login.scss`
- `admin-panel/src/components/visuals/MomentumSafetyBackground.jsx`
- `admin-panel/src/components/common/GlassCard.jsx`
- `admin-panel/src/components/common/PageHeader.jsx`
- `admin-panel/src/components/layout/Sidebar.jsx`
- `admin-panel/src/components/layout/Topbar.jsx`
- `admin-panel/src/pages/ReportsPage.jsx`
- `admin-panel/src/utils/detailPdfExport.js`
- `admin-panel/src/utils/pdfExport.js`

## 7. Files Removed

- `admin-panel/src/styles/login.css`
- `admin-panel/src/styles/login/_road-scene.scss`
- `admin-panel/src/styles/login/_variables.scss`
- `admin-panel/src/components/visuals/LiveRoadScene.jsx`
- `admin-panel/src/App.css`
- `admin-panel/src/logo.svg`

These were obsolete or unused presentation assets. No active authentication service, context, or API file was removed.

## 8. New Login Architecture

`LoginPage` contains only a decorative `AnimatedCorporateBackground`, the existing `LoginPanel`, and the authorization notice. The card is the sole branded content surface and contains one accessible Vertis wordmark. The square momentum SVG is decorative (`alt=""`, hidden background context, pointer-events disabled) and does not count as a second logo.

## 9. SVG Rotation And Positioning

Translation and rotation use separate wrappers so transforms do not overwrite each other. The responsive square mark uses its real 893:894 aspect ratio, `width: clamp(650px, 70vw, 1080px)`, `left: clamp(-560px, -28vw, -300px)`, and a 68-second linear clockwise rotation. Tablet/mobile rules reduce opacity and move it farther left. Reduced-motion disables rotation and card movement.

## 10. Glass Card And Authentication Preservation

The 470px maximum card uses a sufficiently opaque warm-white surface, 20px blur, fine border, shared 24px radius, controlled shadow, and a solid fallback when backdrop filters are unavailable. Login, OTP, resend timing, recovery, remember-me, show-password, field validation, request locking, focus transfer, CSRF/cookie/JWT handling, role redirect, session restore, and friendly errors remain unchanged.

## 11. Accessibility And Performance

The semantic form, labels, autocomplete, Enter submission, focus-visible states, aria-live errors/status, accessible password toggle, OTP focus, and keyboard controls are preserved. Motion uses transform/opacity only. No WebGL, video background, remote image, or additional animation library was introduced. The production bundle became slightly smaller. Mobile controls remain at least 44px high and the page prevents horizontal overflow.

## 12. Unified Portal Design

The portal background now reuses the same red/charcoal gradient, subtle grid, and local momentum mark as login. Shared tokens drive primary actions, inputs, focus, active navigation, lock control, topbar/sidebar borders, cards, page headers, report filters, tables, and selection. Semantic success, warning, danger, and risk colors remain distinct rather than turning every state red. The Dashboard-only topbar route rule remains unchanged.

## 13. Reports Page

Filters use a responsive five-column grid, export actions are grouped and tagged for print exclusion, the primary Generate action uses the shared button token, table hover/header accents use controlled Vertis red, and the main distribution chart uses the extracted brand color. Existing loading, empty, error, Excel/CSV/PDF actions, and overflow-safe table container remain active.

## 14. PDF Root Causes And Fixes

The audit found two active jsPDF paths: record-detail reports in `detailPdfExport.js` and summary exports in `pdfExport.js`. They duplicated margins, colors, and footer logic; summary exports always used landscape; the detail wordmark was forced into a square; Training omitted useful concept/location/remarks fields; and post-processed headers were unreliable on some AutoTable continuation pages.

`pdfDesign.js` now centralizes A4 format/unit, 14mm side margins, 22mm footer reserve, Vertis colors, and the authorized footer. Detail tables draw headers during the AutoTable/manual page lifecycle. The wordmark is aspect-fitted. Summary tables repeat headers, avoid short-row splits, wrap long cells, use print-safe alternating rows, and choose portrait only for compact reports; wider reports such as the ten-column Training report use A4 landscape rather than unreadably shrinking content.

## 15. Official PDF Fields

Work details retain approval reference, work/location/chainage, official workflow actors and remarks, completion, GPS address/coordinates, evidence counts/media, timeline, generated date, and page number. Hazard retains category/risk, site/location, reporter/action team, corrective action, status, evidence, description, and timeline. Training includes title, concept, trainer, category, location, duration, completions, remarks, upload date, and status. Summary mappings exclude database IDs, raw JSON, internal keys, raw provider URLs, debug fields, and unrelated technical fields.

## 16. A4, Images, Long Text, And Print

Detail reports are A4 portrait. Wide summary reports use A4 landscape only when column count requires it. Text uses dynamic wrapping and page-break checks; tables reserve header/footer space. Evidence images retain aspect ratio within fixed printable bounds, captions wrap addresses and GPS data, and videos use thumbnails with a secure fallback link rather than printing a raw URL. Shared print CSS removes navigation/actions/filters, resets screen overflow, and uses A4 portrait defaults for HTML print surfaces.

## 17. Validation Results

- Frontend tests: 25/25 passed across 8 suites.
- Backend tests: 14/14 passed.
- ESLint: passed.
- Production build: passed; CSS and JavaScript output decreased slightly.
- PDF metadata: Work 3-page A4 portrait; Hazard 3-page A4 portrait; Training 2-page A4 landscape.
- Rendered QA: all eight pages inspected; margins, wrapping, continuation headers, authorized footers, tables, page numbers, and long descriptions were readable with no overlap or overflow.
- `git diff --check` and final source checks are part of the final verification pass.

## 18. Browser And Device Results

Automated component/layout tests verify one accessible logo, the local rotating asset, semantic login form, authorization notice, Dashboard-only topbar behavior, and active navigation structure. The in-app browser could not initialize because of an environment runtime conflict, so interactive Chrome/Edge/Firefox/Safari and physical mobile checks could not be honestly claimed here. Those remain the staging release gate, including 320/375/390/768/1024/1366/1920 widths, reduced motion, OTP/recovery, keyboard focus, print preview, and CPU profiling.

## 19. Render Redeployment

1. Review and commit the changes.
2. Push the deployment branch.
3. Redeploy the frontend/static service; no new environment variable is required.
4. Keep the existing backend service configuration because authentication APIs and schemas did not change.
5. Clear the CDN/service-worker cache if an older hashed CSS bundle remains visible.
6. Run the staging browser/device checklist before promoting production traffic.

## 20. Future HO Server Considerations

Serve the built frontend and API over HTTPS, retain existing CORS/cookie/CSRF settings, cache hashed static assets, avoid caching `index.html` indefinitely, and install fonts available to the selected PDF/browser runtime. Validate office-PC GPU/blur performance and use reduced motion where policy requires it. For centrally generated PDFs, pin the browser/jsPDF versions and retain the rendered-fixture regression process.

## 21. Remaining Limitations

The existing Create React App build still reports its bundle-size advisory and Node's `fs.F_OK` deprecation warning. These are not runtime build failures and were not addressed with unrelated dependency upgrades. Interactive cross-browser/physical-device verification remains required because the browser connection was unavailable in this environment.
