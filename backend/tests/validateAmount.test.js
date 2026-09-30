import { describe, it, expect } from "vitest";
import { validateAmount } from "../src/validateAmount.js";

describe("validateAmount", () => {
  it("accepts a positive number", () => {
    expect(validateAmount(100)).toBe(true);
  });

  it("accepts a positive decimal", () => {
    expect(validateAmount(0.5)).toBe(true);
  });

  it("rejects zero", () => {
    expect(validateAmount(0)).toBe(false);
  });

  it("rejects a negative number", () => {
    expect(validateAmount(-50)).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(validateAmount(Infinity)).toBe(false);
  });

  it("rejects a number as a string", () => {
    expect(validateAmount("100")).toBe(false);
  });

  it("rejects a missing amount", () => {
    expect(validateAmount(undefined)).toBe(false);
    expect(validateAmount(null)).toBe(false);
  });
});
