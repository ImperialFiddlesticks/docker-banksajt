export function validateAmount(amount) {
  return Number.isFinite(amount) && amount > 0;
}
