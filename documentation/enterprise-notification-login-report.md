# Enterprise Notification Engine And 3D Login Report

## Notification Architecture

- Added `backend/src/services/notification.service.js` as the enterprise notification engine.
- Kept `backend/src/services/notifications.service.js` as a compatibility wrapper for existing imports.
- Notifications now support in-app delivery, email delivery, future push readiness, user preferences, retry-safe email delivery, related module/record metadata, URL targets, icons, colors, priority, read/archive state, and expiration.
- Workflow recipients are resolved from active users by role and backend work permissions. No email addresses are hardcoded.

## Workflow Email Notifications

Work approval stages now trigger role-based notifications:

- Created or resubmitted: checkers with `work.check`.
- Checked: recommenders with `work.recommend`.
- Recommended: final approvers with `work.approve`.
- Approved: creator.
- Returned: creator with returned by, role, and reason.
- Completed or partially completed: creator, checker, recommender, approver, Admin, and Super Admin.

Email templates include responsive HTML, company logo when configured, gradient header, work information, workflow progress, action button, plain-text fallback, and footer.

## In-App Notification Center

- Upgraded the top navigation bell into a grouped dropdown.
- Shows unread badge, unread/read tabs, Today/Yesterday/This Week/Earlier groups, typed icons, color priority badges, and 30-second polling.
- Clicking a notification marks it read and opens the related module.
- Architecture remains polling-based today and can be replaced by Socket.IO later.

## Dashboard Tasks And Alerts

- Dashboard summary now includes `assignedTasks` and `alerts`.
- Assigned tasks include Pending Check, Pending Recommendation, Pending Approval, Returned Work, and Incomplete Work.
- Dashboard alert banners show work approvals needing attention, hazards awaiting closure, and pending training.

## 3D Login Architecture

Added componentized login experience under `admin-panel/src/components/login/`:

- `HelmetScene.jsx`
- `WorkerModel.jsx`
- `HelmetModel.jsx`
- `Environment.jsx`
- `LoginPanel.jsx`
- `LoadingOverlay.jsx`
- `AnimatedBackground.jsx`
- `ppeSequence.js`

The scene uses React Three Fiber, Three.js, Drei, GSAP, Framer Motion, React Suspense, procedural optimized geometry, cinematic camera movement, animated warehouse lighting, particles, scan overlay, glassmorphism login form, OTP step, and fallback rendering.

## PPE Readiness Login Flow

The login sequence now reinforces safety culture before authentication:

- Worker starts without completed PPE status.
- User begins secure login.
- PPE sequence equips Helmet, Reflective Vest, and Safety Shoes.
- UI and 3D scene update together through shared `ppeSequence.js` state.
- Status changes to `Safety Check Passed`.
- Login panel fades in and the existing OTP authentication flow continues unchanged.

The current worker and PPE elements are optimized procedural R3F geometry for dependable production builds. The module boundaries allow future replacement with Mixamo/GLB worker, helmet, vest, shoe, and HDRI assets without changing the authentication flow.

## Performance And Accessibility

- R3F scene is lazy-loaded.
- Mobile, low-hardware, reduced-motion, or unsupported WebGL environments use a lightweight fallback.
- Production sourcemaps are disabled for the admin panel to avoid third-party sourcemap warnings and reduce deploy output.
- Login provides Skip Animation, cancellable animation timeline handling, and keyboard-friendly controls.

## Validation

- Backend syntax checks passed for updated services and routes.
- `npm test` passed.
- `admin-panel` production build passed.

## Notes

- npm reports dependency audit findings after adding the 3D stack. A breaking `npm audit fix --force` was intentionally not run.
- Live SMTP delivery, real user-role email receipt, and browser FPS profiling should be verified in staging with production-like accounts and hardware.
