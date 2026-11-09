import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAdminPath, isProtectedPath, isPublicPath, safeNextPath } from "@/lib/routes";

describe("route guards (login-first)", () => {
  for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/auth/confirm"]) {
    it(`${path} is reachable without signing in`, () => assert.equal(isPublicPath(path), true));
  }

  for (const path of [
    "/",
    "/dashboard",
    "/marketplace",
    "/browse",
    "/listings/abc",
    "/listings/new",
    "/notifications",
    "/settings",
    "/admin",
    "/some-page-added-later",
  ]) {
    it(`${path} requires sign-in`, () => assert.equal(isProtectedPath(path), true));
  }

  it("does not treat look-alike paths as public", () => {
    assert.equal(isPublicPath("/login-help"), false);
    assert.equal(isPublicPath("/registered"), false);
    assert.equal(isPublicPath("/authentic"), false);
  });

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
