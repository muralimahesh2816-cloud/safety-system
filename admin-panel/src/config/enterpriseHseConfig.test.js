import {
  DEPRECATED_HSE_MODULE_KEYS,
  ENTERPRISE_HSE_KEYS,
  ENTERPRISE_HSE_MODULES,
  NAV_GROUPS,
  getEnterpriseModule,
  isDeprecatedHseModule
} from "./enterpriseHseConfig";
import { canAccessModule, normalizePermissions } from "../utils/permissions";

describe("enterprise HSE module registry", () => {
  test("registry contains only the modules the portal still runs", () => {
    expect(ENTERPRISE_HSE_KEYS.length).toBeGreaterThan(0);
    expect(new Set(ENTERPRISE_HSE_KEYS).size).toBe(ENTERPRISE_HSE_KEYS.length);
  });

  test("retired modules are gone from the registry, not merely hidden", () => {
    // A retired module must have no definition at all — no route can resolve
    // to it, no sidebar entry can render it, and getEnterpriseModule() must
    // not hand a caller a usable config for it.
    DEPRECATED_HSE_MODULE_KEYS.forEach((key) => {
      expect(ENTERPRISE_HSE_KEYS).not.toContain(key);
      expect(getEnterpriseModule(key)).toBeNull();
      expect(isDeprecatedHseModule(key)).toBe(true);
    });
  });

  test("retired modules are absent from every navigation group", () => {
    const navigationKeys = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    DEPRECATED_HSE_MODULE_KEYS.forEach((key) => expect(navigationKeys).not.toContain(key));
  });

  test("every navigation group still has at least one item", () => {
    NAV_GROUPS.forEach((group) => expect(group.items.length).toBeGreaterThan(0));
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
    expect(canAccessModule({ role: "viewer", permissions: {} }, "permits")).toBe(true);
  });
});
