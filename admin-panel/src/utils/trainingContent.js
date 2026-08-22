import {
  CATEGORIES,
  CATEGORY_LABELS,
  HSE_TRAINING_CATALOG,
  getCatalogConcept
} from "../config/hseTrainingCatalog";
import { getMediaUrl } from "./media";

// Bridges the two sources of training content:
//   1. Training records stored in MongoDB (the system of record), and
//   2. the HSE curriculum in config/hseTrainingCatalog.js.
//
// A stored record always wins. The catalogue only fills gaps — so an existing
// training that has never carried hazards or practice guidance can present the
// standard content for its concept, while anything a Safety Manager actually
// authored is shown verbatim and never overwritten.

const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Title -> catalogue entry, so a legacy record named "Working at Height" picks
// up the matching concept even though it predates `catalogId`.
const CATALOG_BY_SLUG = new Map(HSE_TRAINING_CATALOG.map((item) => [slugify(item.title), item]));

const CATEGORY_KEY_BY_LABEL = new Map(
  CATEGORIES.map((category) => [category.label.toLowerCase(), category.key])
);

// Free-text categories that existing records use, mapped onto catalogue keys.
const CATEGORY_ALIASES = {
  ppe: "ppe",
  "personal protective equipment": "ppe",
  electrical: "electrical",
  "electrical safety": "electrical",
  fire: "fire",
  "fire safety": "fire",
  "fire & emergency safety": "fire",
  emergency: "fire",
  road: "road",
  "road safety": "road",
  "highway safety": "road",
  "traffic management": "road",
  construction: "construction",
  "construction safety": "construction",
  "construction site safety": "construction",
  "work at height": "construction",
  chemical: "chemical",
  "chemical safety": "chemical",
  industrial: "industrial",
  manufacturing: "industrial",
  "manufacturing safety": "industrial"
};

export const resolveCategoryKey = (category = "") => {
  const value = String(category || "").trim().toLowerCase();
  if (!value) return "general";
  return CATEGORY_KEY_BY_LABEL.get(value) || CATEGORY_ALIASES[value] || "general";
};

export const resolveCategoryLabel = (category = "") => {
  const key = resolveCategoryKey(category);
  return CATEGORY_LABELS[key] || category || "General";
};

/** Picks the catalogue entry a record corresponds to, if any. */
const findCatalogMatch = (record = {}) =>
  (record.catalogId ? getCatalogConcept(record.catalogId) : null) ||
  CATALOG_BY_SLUG.get(slugify(record.title)) ||
  null;

const firstNonEmptyList = (...candidates) =>
  candidates.find((value) => Array.isArray(value) && value.length > 0) || [];

/**
 * Normalises one training record (from `GET /training`) into the single shape
 * the Training UI renders, merging in catalogue content where the record has
 * none of its own.
 */
export const normalizeTraining = (record = {}) => {
  const catalog = findCatalogMatch(record);
  const categoryKey = resolveCategoryKey(record.category || catalog?.category);

  return {
    ...record,
    _id: record._id || record.id,
    catalogId: record.catalogId || catalog?.id || "",
    title: record.title || catalog?.title || "Untitled training",
    description: record.description || catalog?.concept || "",
    concept: record.concept || catalog?.concept || "",
    objective: record.objective || catalog?.objective || "",
    categoryKey,
    categoryLabel: resolveCategoryLabel(record.category || catalog?.category),
    durationMinutes: record.durationMinutes || catalog?.duration || 10,
    visualKey: record.visualKey || catalog?.visual || "constructionSite",
    hazards: firstNonEmptyList(record.hazards, catalog?.hazards),
    correctPractice: firstNonEmptyList(record.correctPractice, catalog?.correctPractice),
    incorrectPractice: firstNonEmptyList(record.incorrectPractice, catalog?.incorrectPractice),
    requiredPpe: firstNonEmptyList(record.requiredPpe, catalog?.ppe),
    thumbnailUrl: getMediaUrl(record.thumbnail?.url || record.thumbnail || record.banner) || "",
    videoUrl: getMediaUrl(record.video?.url || record.video) || "",
    passingScore: record.passingScore ?? null,
    // Present only for catalogue-backed records that have not been uploaded yet.
    isCatalogPreview: false
  };
};

/**
 * Catalogue entries that no stored training covers yet.
 *
 * These are shown to Safety Managers and Admins as the remaining curriculum,
 * clearly marked as not-yet-published, with a one-click pre-fill into the
 * upload form. Employees never see them, because a concept with no published
 * training is not something they can complete.
 */
export const buildCatalogPreviews = (records = []) => {
  const covered = new Set();
  records.forEach((record) => {
    if (record.catalogId) covered.add(record.catalogId);
    const slug = slugify(record.title);
    const match = CATALOG_BY_SLUG.get(slug);
    if (match) covered.add(match.id);
  });

  return HSE_TRAINING_CATALOG.filter((item) => !covered.has(item.id)).map((item) => ({
    _id: `catalog:${item.id}`,
    catalogId: item.id,
    title: item.title,
    description: item.concept,
    concept: item.concept,
    objective: item.objective,
    category: CATEGORY_LABELS[item.category],
    categoryKey: item.category,
    categoryLabel: CATEGORY_LABELS[item.category],
    durationMinutes: item.duration,
    visualKey: item.visual,
    hazards: item.hazards,
    correctPractice: item.correctPractice,
    incorrectPractice: item.incorrectPractice,
    requiredPpe: item.ppe,
    thumbnailUrl: "",
    videoUrl: "",
    passingScore: null,
    isPublished: false,
    isCatalogPreview: true
  }));
};

/** Payload for pre-filling the upload form from a catalogue concept. */
export const catalogToFormValues = (concept) => ({
  title: concept.title,
  description: concept.concept,
  category: CATEGORY_LABELS[concept.category] || concept.category,
  concept: concept.concept,
  catalogId: concept.id,
  visualKey: concept.visual,
  objective: concept.objective,
  durationMinutes: String(concept.duration || ""),
  hazards: concept.hazards || [],
  correctPractice: concept.correctPractice || [],
  incorrectPractice: concept.incorrectPractice || [],
  requiredPpe: concept.ppe || []
});

/** Categories that actually have something in them, for the filter bar. */
export const buildCategoryFilters = (trainings = []) => {
  const counts = new Map();
  trainings.forEach((item) => {
    counts.set(item.categoryKey, (counts.get(item.categoryKey) || 0) + 1);
  });

  const known = CATEGORIES.filter((category) => counts.has(category.key)).map((category) => ({
    key: category.key,
    label: category.label,
    count: counts.get(category.key)
  }));

  const general = counts.get("general")
    ? [{ key: "general", label: "General", count: counts.get("general") }]
    : [];

  return [{ key: "all", label: "All Training", count: trainings.length }, ...known, ...general];
};
