# Backup Readiness Guide

The current production deployment is unchanged. Backups are prepared through a provider-neutral readiness contract that can later point to HO infrastructure.

## Endpoint

`GET /api/v1/backup/readiness`

Authentication: required.

Authorization: `settings.view`.

The endpoint does not run a backup job. It reports whether each backup target is discoverable and which future strategy should be used.

## Backup Targets

| Target | Current Source | Future HO Strategy |
| --- | --- | --- |
| MongoDB | MongoDB Atlas | Scheduled Atlas backups or `mongodump` export into approved HO storage. |
| Uploaded files | Cloudinary or local upload directories | Export Cloudinary folder assets or archive local upload directories. |
| Reports | Generated from database and media references | Regenerate from restored MongoDB and uploaded media. |
| Configuration | Environment variables | Store approved configuration in HO secret management. |

## Readiness Fields

| Field | Meaning |
| --- | --- |
| `backupProvider` | Current provider label from `BACKUP_PROVIDER`. |
| `retentionDays` | Retention value from `BACKUP_RETENTION_DAYS`. |
| `targets.mongodb.uriConfigured` | Whether the database connection string is configured. |
| `targets.uploadedFiles.cloudinaryConfigured` | Whether Cloudinary credentials are present. |
| `targets.uploadedFiles.localDirectories` | Local upload paths and read status. |
| `targets.configuration.secretsExcludedFromApi` | Confirms that secret values are not returned. |

## Operational Notes

- Keep MongoDB Atlas automated backups enabled until HO migration is approved.
- Export Cloudinary assets by folder/public id before any migration window.
- Store `.env` values in an approved secret store; do not commit secrets.
- The readiness endpoint is audit logged as `backup_readiness_view`.
