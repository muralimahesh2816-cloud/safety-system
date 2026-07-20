import { ROLE_GROUPS, ROLE_LABELS, ROLES } from "./roles";

test("Supervisor is presented once as a General Role", () => {
  const generalRoles = ROLE_GROUPS.find((group) => group.label === "General Roles")?.roles || [];
  const allRoleEntries = ROLE_GROUPS.flatMap((group) => group.roles);

  expect(ROLE_LABELS[ROLES.SUPERVISOR]).toBe("Supervisor");
  expect(generalRoles).toContain(ROLES.SUPERVISOR);
  expect(allRoleEntries.filter((role) => role === ROLES.SUPERVISOR)).toHaveLength(1);
});
