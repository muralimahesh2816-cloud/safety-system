export const checkedByUsers = [
  "Safety Officer",
  "Safety Engineer",
  "Site Engineer",
  "Project Engineer",
  "Maintenance Engineer"
];

export const recommendedByUsers = [
  "Project Manager",
  "Construction Manager",
  "Operations Manager",
  "Maintenance Manager",
  "Safety Manager"
];

export const workTypes = [
  "Road Work",
  "Lights Changing",
  "Height Work",
  "Grass Cutting",
  "Watering Plants",
  "Plaza Maintenance"
];

export const areaSizes = ["Small", "Medium", "Large", "Critical"];

export const statusColors = {
  Pending: {
    text: "text-amber-300",
    badge: "border-amber-400/30 bg-amber-500/10 text-amber-200"
  },
  Approved: {
    text: "text-sky-300",
    badge: "border-sky-400/30 bg-sky-500/10 text-sky-200"
  },
  Rejected: {
    text: "text-rose-300",
    badge: "border-rose-400/30 bg-rose-500/10 text-rose-200"
  },
  Completed: {
    text: "text-emerald-300",
    badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
  }
};

export const approvalStatuses = ["Pending", "Approved", "Rejected", "Completed"];
