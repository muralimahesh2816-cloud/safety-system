export const getTopbarVisibility = ({ previousScrollTop, nextScrollTop, interacting = false }) => {
  const delta = nextScrollTop - previousScrollTop;
  if (interacting || nextScrollTop <= 12 || delta < -4) return true;
  if (delta > 8) return false;
  return null;
};
