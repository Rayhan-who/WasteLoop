import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAdminPath, isAppPath, isProtectedPath, safeNextPath } from "@/lib/routes";

describe("route guards", () => {
  for (const path of ["/dashboard", "/listings/new", "/listings/abc/edit", "/my-listings", "/requests/1", "/settings"]) {
    it(`${path} requires sign-in`, () => assert.equal(isAppPath(path), true));
  }

  for (const path of ["/", "/browse", "/listings/abc", "/login", "/register", "/dashboards-are-not-this"]) {
    it(`${path} is public`, () => assert.equal(isProtectedPath(path), false));
  }

  it("guards the admin group", () => {
    assert.equal(isAdminPath("/admin"), true);
    assert.equal(isAdminPath("/admin/audit"), true);
    assert.equal(isAdminPath("/administrator"), false);
  });
});

describe("safeNextPath", () => {
  it("allows same-origin relative paths", () => {
    assert.equal(safeNextPath("/requests/1?tab=chat"), "/requests/1?tab=chat");
  });

  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "", null, undefined]) {
    it(`rejects ${String(next)}`, () => assert.equal(safeNextPath(next), "/dashboard"));
  }
});
