import { en, type Messages } from "./messages/en";
import { vi, type Localized } from "./messages/vi";

export type Locale = "en";

export const DEFAULT_LOCALE: Locale = "en";

export type Dictionary = Messages;

/** Resolve the message dictionary (standardized on English). */
export function getMessages(_locale?: string): Dictionary {
  return en;
}

/**
 * Read a dot-path key from a messages dictionary, e.g. `t(messages, "nav.setup")`.
 * Returns the key itself if the path is missing (visible-but-safe fallback).
 */
export function t(messages: Dictionary, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      messages,
    );
  return typeof value === "string" ? value : key;
}

export { en };
export type { Messages };
