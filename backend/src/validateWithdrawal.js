import { validateAmount } from "./validateAmount.js";

export function validateWithdrawal(amount, balance) {
  if (!validateAmount(amount)) {
    return { ok: false, error: "Invalid amount" };
  }
  if (amount > balance) {
    return { ok: false, error: "Insufficient funds" };
  }
  return { ok: true };
}
