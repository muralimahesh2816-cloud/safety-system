# Work Approval Chainage Migration

The canonical fields are `requestedChainageFrom`, `requestedChainageTo`, `approvedChainageFrom`, and `approvedChainageTo`. Legacy `chainage`, `chainageNo`, `chainageFrom`, and `chainageTo` fields remain readable for backward compatibility and are not deleted.

1. Take an Atlas snapshot or export the `workapprovals` collection.
2. Run `npm run audit:work-fields` and review counts and samples.
3. Run `npm run migrate:work-chainage` for a dry run.
4. Run `npm run migrate:work-chainage -- --apply` only after review.
5. Run the audit again and compare counts.

The migration is idempotent and only fills missing canonical fields. It never overwrites an existing canonical value and does not remove legacy fields. Rollback uses the database snapshot; no automatic destructive rollback is provided.
