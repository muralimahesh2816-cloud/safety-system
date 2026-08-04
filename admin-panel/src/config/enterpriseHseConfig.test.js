import {
  ENTERPRISE_HSE_KEYS,
  ENTERPRISE_HSE_MODULES,
  NAV_GROUPS,
  getEnterpriseModule
} from "./enterpriseHseConfig";
import { canAccessModule, normalizePermissions } from "../utils/permissions";

describe("enterprise HSE module registry", () => {
  test("contains ten phase one and ten phase two functional modules", () => {
    expect(ENTERPRISE_HSE_MODULES.filter((module) => module.phase === 1)).toHaveLength(10);
    expect(ENTERPRISE_HSE_MODULES.filter((module) => module.phase === 2)).toHaveLength(10);
    expect(new Set(ENTERPRISE_HSE_KEYS).size).toBe(20);
  });

  test("every module has workflow, categories, dates, and module detail fields", () => {
    ENTERPRISE_HSE_MODULES.forEach((module) => {
      expect(module.statuses.length).toBeGreaterThan(1);
      expect(module.categories.length).toBeGreaterThan(0);
      expect(module.dateFields.length).toBeGreaterThan(0);
      expect(module.details.length).toBeGreaterThan(0);
    });
  });

  test("grouped navigation exposes every enterprise module once", () => {
    const navigationKeys = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    ENTERPRISE_HSE_KEYS.forEach((key) => expect(navigationKeys.filter((item) => item === key)).toHaveLength(1));
    expect(getEnterpriseModule("incidents").label).toBe("Incident Management");
  });

  test("legacy users receive enterprise view access while explicit denial is preserved", () => {
    const normalized = normalizePermissions({ incidents: false }, "supervisor");
    expect(normalized.permits).toBe(true);
    expect(normalized.incidents).toBe(false);
    expect(canAccessModule({ role: "viewer", permissions: {} }, "capa")).toBe(true);
  });
});
