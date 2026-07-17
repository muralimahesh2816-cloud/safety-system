# Permission Matrix

Backend authorization is enforced through `authorizePermission` and `authorizeRoles`. Frontend visibility is treated as convenience only.

## Work Approval Workflow

| Stage | Primary Roles |
| --- | --- |
| Create work | Employee, operational roles, managers, Admin, Super Admin based on `work.create`. |
| Check work | Safety Officer, Safety Engineer, Site Engineer, Project Engineer, Maintenance Engineer with `work.check`. |
| Recommend work | Project Manager, Construction Manager, Operations Manager, Maintenance Manager, Safety Manager with `work.recommend`. |
| Final approval | Project Manager, Maintenance Manager, Admin, Super Admin with `work.approve`. |
| Return for correction | Current reviewer role for the active stage with `work.return`. |
| Complete or partial complete | Creator, assigned user, Super Admin, or role with `work.complete`. |
| Delete work | Admin or Super Admin. |

The workflow also prevents the same non-Super Admin user from performing conflicting sequential stages on the same work approval.

## Module Access

| Module | View | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| Dashboard | Role permission | N/A | N/A | N/A |
| Users | Admin-managed permission | Admin/Super Admin | `users.update` | Admin/Super Admin |
| Work approvals | `work.view` | `work.create` | `work.update` plus stage permissions | Admin/Super Admin |
| Hazards | `hazards.view` | `hazards.create` | `hazards.update` | `hazards.delete` or Admin/Super Admin |
| Training | `training.view` | `training.create` | `training.update` | Admin/Super Admin |
| Reports | `reports.view` | N/A | N/A | N/A |
| Settings | `settings.view` | N/A | `settings.update` | N/A |
| Notifications | `notifications.view` | service generated | `notifications.update` | N/A |
| System Health | Settings-view users | N/A | N/A | N/A |

## Role Defaults

Super Admin receives all module and stage permissions. Admin receives broad management permissions. Engineering, officer, and manager roles receive workflow permissions appropriate to their stage. Employee/User roles can create and view work by default but do not receive approval-stage authority unless explicitly assigned.
