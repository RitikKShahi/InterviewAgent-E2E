import { describe, expect, it } from "vitest";
import { en } from "../lib/i18n/messages/en";
import { vi } from "../lib/i18n/messages/vi";
import { DEFAULT_LOCALE, getMessages, t } from "../lib/i18n";

/** Every string leaf path in `en`, e.g. ["nav.setup", "interview.end", ...]. */
function leafPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

describe("English UI dictionary", () => {
  it("resolves English dictionary exclusively", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getMessages("en")).toBe(en);
    expect(getMessages("vi")).toBe(en);
    expect(t(getMessages("en"), "setup.start")).toBe("Start interview");
  });

  it("falls back visibly for unknown keys", () => {
    expect(t(getMessages("en"), "no.such.key")).toBe("no.such.key");
  });
});
