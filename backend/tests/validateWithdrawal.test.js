import { describe, it, expect } from "vitest";
import { validateWithdrawal } from "../src/validateWithdrawal.js";

describe("validateWithdrawal", () => {
  it("accepts a withdrawal smaller than the balance", () => {
    expect(validateWithdrawal(40, 100)).toEqual({ ok: true });
  });

  it("accepts withdrawing the entire balance", () => {
    expect(validateWithdrawal(100, 100)).toEqual({ ok: true });
  });

  it("rejects a withdrawal larger than the balance", () => {
    expect(validateWithdrawal(150, 100)).toEqual({
      ok: false,
      error: "Insufficient funds",
    });
  });

  it("rejects any withdrawal from an empty account", () => {
    expect(validateWithdrawal(1, 0)).toEqual({
      ok: false,
      error: "Insufficient funds",
    });
  });

  it("rejects zero", () => {
    expect(validateWithdrawal(0, 100)).toEqual({
      ok: false,
      error: "Invalid amount",
    });
  });

  it("rejects a negative number", () => {
    expect(validateWithdrawal(-50, 100)).toEqual({
      ok: false,
      error: "Invalid amount",
    });
  });

  it("rejects Infinity and NaN", () => {
    expect(validateWithdrawal(Infinity, 100)).toEqual({
      ok: false,
      error: "Invalid amount",
    });
    expect(validateWithdrawal(NaN, 100)).toEqual({
      ok: false,
      error: "Invalid amount",
    });
  });

  it("rejects a number as a string", () => {
    expect(validateWithdrawal("40", 100)).toEqual({
      ok: false,
      error: "Invalid amount",
    });
  });
});
