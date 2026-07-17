export const PPE_STEPS = [
  {
    key: "helmet",
    label: "Helmet",
    description: "Head protection secured",
    scanLabel: "Helmet locked"
  },
  {
    key: "vest",
    label: "Reflective Vest",
    description: "Visibility protection active",
    scanLabel: "Vest illuminated"
  },
  {
    key: "shoes",
    label: "Safety Shoes",
    description: "Foot protection confirmed",
    scanLabel: "Safety shoes verified"
  }
];

export const getPpeProgress = (step = 0) =>
  PPE_STEPS.map((item, index) => ({
    ...item,
    complete: step > index
  }));

export const isSafetyPassed = (step = 0) => step >= PPE_STEPS.length;
