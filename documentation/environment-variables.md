# Environment Variable Guide

This deployment remains React frontend, Node/Express backend, MongoDB Atlas, Render, and Cloudinary or local upload fallback.

## Required

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string. |
| `FRONTEND_URL` | Allowed frontend origin list, comma-separated when needed. |
| `BACKEND_PUBLIC_URL` | Public backend origin used for CORS, CSP, media URLs, and monitoring. |
| `JWT_ACCESS_SECRET` | Strong secret for access tokens. |
| `JWT_REFRESH_SECRET` | Strong secret for refresh tokens and CSRF signing. |

## Production Required

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP host for OTP and notification email. |
| `SMTP_PORT` | SMTP port. Defaults to `587`. |
| `SMTP_USER` | SMTP username. |
| `SMTP_PASS` | SMTP password. |
| `SMTP_FROM` | Sender address. Defaults to `SMTP_USER` when not set. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for media storage. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. |

If Cloudinary is intentionally not used in production, set `ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true`.

## Security

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Enables production-only validation and response behavior. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime. |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost. Values below `10` warn at startup. |
| `SESSION_TIMEOUT_MINUTES` | `30` | Frontend inactivity timeout fallback. |
| `ENFORCE_OTP_AUTH` | `false` | Forces OTP after password validation when set to `true`. |
| `RATE_LIMIT_WINDOW_MS` | `600000` | API rate limit window. |
| `RATE_LIMIT_MAX` | `300` | API requests allowed per window. |

## Media And Backup

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLOUDINARY_UPLOAD_FOLDER` | `uploads` | Cloudinary folder root. |
| `ALLOW_LOCAL_UPLOADS_IN_PRODUCTION` | `false` | Allows local upload storage in production when Cloudinary is absent. |
| `BACKUP_PROVIDER` | `manual` | Future backup adapter identifier. |
| `BACKUP_STORAGE_URI` | unset | Future backup target URI. The API only reports whether it is configured. |
| `BACKUP_RETENTION_DAYS` | `30` | Retention value shown in backup readiness. |

## Startup Validation

The backend validates required configuration during startup. In production, missing JWT secrets, SMTP settings, or Cloudinary settings fail fast with a clear error instead of allowing an unsafe deployment.
