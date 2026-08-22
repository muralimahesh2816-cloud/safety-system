import {
  buildCatalogPreviews,
  buildCategoryFilters,
  normalizeTraining,
  resolveCategoryKey,
  resolveCategoryLabel
} from "./trainingContent";
import { HSE_TRAINING_CATALOG } from "../config/hseTrainingCatalog";

test("a stored training's own content always wins over the catalogue", () => {
  const normalized = normalizeTraining({
    _id: "t1",
    title: "Working at Height",
    category: "Construction Site Safety",
    description: "Site-specific version",
    hazards: ["Site-specific hazard"],
    correctPractice: ["Site-specific control"]
  });

  expect(normalized.hazards).toEqual(["Site-specific hazard"]);
  expect(normalized.correctPractice).toEqual(["Site-specific control"]);
  expect(normalized.description).toBe("Site-specific version");
});

test("a legacy record with no authored content inherits the matching concept by title", () => {
  const normalized = normalizeTraining({
    _id: "t2",
    title: "Working at Height",
    description: "Old record",
    category: "General"
  });

  // Title-matched to the catalogue even without a catalogId, so pre-upgrade
  // records gain hazards / practice guidance without a data migration.
  expect(normalized.catalogId).toBe("working-at-height");
  expect(normalized.hazards.length).toBeGreaterThan(0);
  expect(normalized.incorrectPractice.length).toBeGreaterThan(0);
  expect(normalized.requiredPpe).toContain("Full-Body Safety Harness");
  // ...but its own description is still what is shown.
  expect(normalized.description).toBe("Old record");
});

test("an unmatched training keeps working and gets no invented content", () => {
  const normalized = normalizeTraining({
    _id: "t3",
    title: "Site-Specific Induction 2026",
    description: "Local induction",
    category: "General"
  });

  expect(normalized.catalogId).toBe("");
  expect(normalized.hazards).toEqual([]);
  expect(normalized.correctPractice).toEqual([]);
  expect(normalized.categoryLabel).toBe("General");
  expect(normalized.visualKey).toBe("constructionSite");
});

test("category resolution maps free-text categories onto catalogue keys", () => {
  expect(resolveCategoryKey("Fire Safety")).toBe("fire");
  expect(resolveCategoryKey("PPE")).toBe("ppe");
  expect(resolveCategoryKey("Manufacturing")).toBe("industrial");
  expect(resolveCategoryKey("Road & Highway Safety")).toBe("road");
  expect(resolveCategoryKey("Something Bespoke")).toBe("general");
  expect(resolveCategoryLabel("Road Safety")).toBe("Road & Highway Safety");
});

test("catalogue previews exclude concepts a stored training already covers", () => {
  const previews = buildCatalogPreviews([
    { _id: "t1", title: "Working at Height" },
    { _id: "t2", catalogId: "fire-extinguisher-use", title: "Extinguisher Drill" }
  ]);

  const ids = previews.map((item) => item.catalogId);
  expect(ids).not.toContain("working-at-height");
  expect(ids).not.toContain("fire-extinguisher-use");
  expect(previews).toHaveLength(HSE_TRAINING_CATALOG.length - 2);
  expect(previews.every((item) => item.isCatalogPreview)).toBe(true);
});

test("category filters only list categories that actually have content", () => {
  const filters = buildCategoryFilters([
    normalizeTraining({ _id: "a", title: "Working at Height", category: "Construction Site Safety" }),
    normalizeTraining({ _id: "b", title: "Fire Prevention", category: "Fire Safety" })
  ]);

  expect(filters[0]).toEqual({ key: "all", label: "All Training", count: 2 });
  expect(filters.map((item) => item.key)).toEqual(["all", "construction", "fire"]);
  expect(filters.find((item) => item.key === "fire").count).toBe(1);
});

test("every catalogue concept carries the teaching content the training UI renders", () => {
  HSE_TRAINING_CATALOG.forEach((concept) => {
    expect(concept.id).toMatch(/^[a-z0-9-]+$/);
    expect(concept.title).toBeTruthy();
    expect(concept.objective).toBeTruthy();
    expect(concept.concept).toBeTruthy();
    expect(concept.hazards.length).toBeGreaterThan(0);
    expect(concept.correctPractice.length).toBeGreaterThan(0);
    expect(concept.incorrectPractice.length).toBeGreaterThan(0);
    expect(concept.visual).toBeTruthy();
  });
});

test("catalogue concept ids are unique", () => {
  const ids = HSE_TRAINING_CATALOG.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
});
