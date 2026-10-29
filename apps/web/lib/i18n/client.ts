"use client";

import { en, type Dictionary, type Locale } from "@/lib/i18n";

export function useMessages(): Dictionary {
  return en;
}

export function useLocale(): Locale {
  return "en";
}
