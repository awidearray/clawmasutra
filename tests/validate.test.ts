import { describe, expect, it } from "vitest";
import { containsContact, parse, photoSchema, registerHumanInput } from "@/lib/validate";
import { AppError } from "@/lib/errors";

describe("validation", () => {
  it("requires https photos", () => {
    expect(() => parse(photoSchema, { url: "http://evil.example/a.jpg" })).toThrow(AppError);
    expect(parse(photoSchema, { url: "https://cdn.example/a.jpg" }).url).toContain("https://");
  });

  it("detects contact leaks", () => {
    expect(containsContact("call me at 512-555-0199")).toBe(true);
    expect(containsContact("email me at ada@example.com")).toBe(true);
    expect(containsContact("want to get a drink Thursday?")).toBe(false);
  });

  it("requires age 18+ and a real email", () => {
    expect(() =>
      parse(registerHumanInput, { email: "nope", password: "abcdefghij", name: "A", age: 18, ageConfirmed: true }),
    ).toThrow(AppError);
    expect(() =>
      parse(registerHumanInput, {
        email: "a@x.com",
        password: "abcdefghij",
        name: "A",
        age: 17,
        ageConfirmed: true,
      }),
    ).toThrow(AppError);
  });
});
