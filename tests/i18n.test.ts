import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { DEFAULT_LOCALE, resolveLocale } from "@/i18n/config";
import { LISTING_OFFER_TYPES, LISTING_STATUSES, USER_ROLES, WASTE_TYPES } from "@/lib/domain";

/** SRS §4.7: both languages complete; no untranslated string reaches the screen. */

type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const enFlat = flatten(en as Messages);
const bnFlat = flatten(bn as Messages);

/** Keys whose value is legitimately identical in both files (brand name, language self-names). */
const IDENTICAL_ALLOWED = new Set(["common.appName", "common.languageNames.bn", "common.languageNames.en", "footer.copyright"]);

describe("message catalogues", () => {
  it("bn.json has every key in en.json", () => {
    assert.deepEqual([...enFlat.keys()].filter((k) => !bnFlat.has(k)), []);
  });

  it("en.json has every key in bn.json", () => {
    assert.deepEqual([...bnFlat.keys()].filter((k) => !enFlat.has(k)), []);
  });

  it("has no empty strings", () => {
    const empty = [...enFlat, ...bnFlat].filter(([, v]) => v.trim() === "").map(([k]) => k);
    assert.deepEqual(empty, []);
  });

  it("Bangla strings are actually translated, not copied from English", () => {
    const copied = [...enFlat].filter(([k, v]) => !IDENTICAL_ALLOWED.has(k) && bnFlat.get(k) === v).map(([k]) => k);
    assert.deepEqual(copied, []);
  });

  it("uses the same ICU placeholders in both languages", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
    const mismatched = [...enFlat]
      .filter(([k, v]) => JSON.stringify(placeholders(v)) !== JSON.stringify(placeholders(bnFlat.get(k) ?? "")))
      .map(([k]) => k);
    assert.deepEqual(mismatched, []);
  });

  it("labels every enum value the UI renders", () => {
    const missing = [
      ...WASTE_TYPES.map((v) => `streams.${v}`),
      ...LISTING_STATUSES.map((v) => `listingStatus.${v}`),
      ...LISTING_OFFER_TYPES.map((v) => `offerTypes.${v}`),
      ...USER_ROLES.map((v) => `roles.${v}`),
    ].filter((k) => !enFlat.has(k));
    assert.deepEqual(missing, []);
  });
});

describe("locale resolution", () => {
  it("defaults new users to Bangla", () => {
    assert.equal(DEFAULT_LOCALE, "bn");
    assert.equal(resolveLocale(undefined), "bn");
    assert.equal(resolveLocale("fr"), "bn");
    assert.equal(resolveLocale("en"), "en");
  });
});
