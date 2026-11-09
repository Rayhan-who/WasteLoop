import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapAuthError } from "@/lib/auth-errors";
import { FORM_ERROR_CODES } from "@/lib/actions/result";
import { VALIDATION_CODES, fieldErrors } from "@/lib/validation/common";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { deactivateSchema, isDeactivateConfirmation, profileSchema, rolesSchema } from "@/lib/validation/profile";
import en from "@/messages/en.json";

const validRegistration = {
  displayName: "  Farhana Akter ",
  orgName: "",
  email: " Farhana@Example.COM ",
  phone: "01711-000101",
  password: "correct horse",
  confirmPassword: "correct horse",
  roles: ["provider"],
};

describe("registration (FR-1.1, FR-1.2)", () => {
  it("accepts and normalises a valid registration", () => {
    const r = registerSchema.parse(validRegistration);
    assert.equal(r.displayName, "Farhana Akter");
    assert.equal(r.email, "farhana@example.com");
    assert.equal(r.orgName, undefined);
    assert.equal(r.phone, "+8801711000101");
  });

  it("requires at least one role", () => {
    const r = registerSchema.safeParse({ ...validRegistration, roles: [] });
    assert.equal(r.success, false);
    assert.equal(fieldErrors(r.error!).roles, "rolesRequired");
  });

  it("never accepts admin as a self-chosen role", () => {
    const r = registerSchema.safeParse({ ...validRegistration, roles: ["provider", "admin"] });
    assert.equal(r.success, false);
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const r = registerSchema.safeParse({ ...validRegistration, confirmPassword: "different" });
    assert.equal(fieldErrors(r.error!).confirmPassword, "passwordsDontMatch");
  });

  it("enforces password length 8–72", () => {
    assert.equal(fieldErrors(registerSchema.safeParse({ ...validRegistration, password: "short", confirmPassword: "short" }).error!).password, "passwordTooShort");
    const long = "x".repeat(73);
    assert.equal(fieldErrors(registerSchema.safeParse({ ...validRegistration, password: long, confirmPassword: long }).error!).password, "passwordTooLong");
  });

  it("rejects an invalid e-mail with a translatable code", () => {
    assert.equal(fieldErrors(registerSchema.safeParse({ ...validRegistration, email: "not-an-email" }).error!).email, "emailInvalid");
  });
});

describe("Bangladeshi mobile numbers", () => {
  for (const input of ["01711000101", "+8801711000101", "8801711000101", "01711 000 101", "019-1234-5678"]) {
    it(`accepts ${input}`, () => {
      const r = profileSchema.parse({ displayName: "A", phone: input });
      assert.match(r.phone!, /^\+8801[3-9]\d{8}$/);
    });
  }
  for (const input of ["01211000101", "0171100010", "+447700900123", "phone"]) {
    it(`rejects ${input}`, () => {
      const r = profileSchema.safeParse({ displayName: "A", phone: input });
      assert.equal(fieldErrors(r.error!).phone, "phoneInvalid");
    });
  }
  it("treats an empty phone as not given", () => {
    assert.equal(profileSchema.parse({ displayName: "A", phone: "  " }).phone, undefined);
  });
});

describe("other forms", () => {
  it("login requires both fields", () => {
    const e = fieldErrors(loginSchema.safeParse({ email: "", password: "" }).error!);
    assert.ok(e.email && e.password);
  });

  it("reset password checks the confirmation", () => {
    assert.equal(
      fieldErrors(resetPasswordSchema.safeParse({ password: "abcdefgh", confirmPassword: "abcdefgx" }).error!).confirmPassword,
      "passwordsDontMatch",
    );
  });

  it("roles update keeps at least one role", () => {
    assert.equal(rolesSchema.safeParse({ roles: [] }).success, false);
    assert.equal(rolesSchema.safeParse({ roles: ["farmer", "charity"] }).success, true);
  });

  it("profile display name is required and trimmed", () => {
    assert.equal(fieldErrors(profileSchema.safeParse({ displayName: "   " }).error!).displayName, "required");
  });

  it("deactivation accepts the confirmation word in either language", () => {
    assert.equal(isDeactivateConfirmation("deactivate"), true);
    assert.equal(isDeactivateConfirmation(" DEACTIVATE "), true);
    assert.equal(isDeactivateConfirmation("নিষ্ক্রিয়"), true);
    assert.equal(isDeactivateConfirmation("delete"), false);
    assert.equal(deactivateSchema.safeParse({ confirmation: "", requestDataRemoval: false }).success, false);
  });
});

describe("error codes are all translatable", () => {
  it("every validation code has an English message", () => {
    const missing = VALIDATION_CODES.filter((c) => !(c in en.validation));
    assert.deepEqual(missing, []);
  });

  it("every form error code has an English message", () => {
    const missing = FORM_ERROR_CODES.filter((c) => !(c in en.formErrors));
    assert.deepEqual(missing, []);
  });
});

describe("mapAuthError", () => {
  it("maps known Supabase codes", () => {
    assert.equal(mapAuthError({ code: "invalid_credentials" }), "invalidCredentials");
    assert.equal(mapAuthError({ code: "email_not_confirmed" }), "emailNotConfirmed");
    assert.equal(mapAuthError({ code: "user_already_exists" }), "emailTaken");
    assert.equal(mapAuthError({ code: "weak_password" }), "weakPassword");
    assert.equal(mapAuthError({ code: "over_email_send_rate_limit" }), "rateLimited");
    assert.equal(mapAuthError({ code: "user_banned" }), "accountSuspended");
    assert.equal(mapAuthError({ code: "otp_expired" }), "sessionExpired");
  });

  it("treats HTTP 429 as rate limiting and anything else as generic", () => {
    assert.equal(mapAuthError({ status: 429 }), "rateLimited");
    assert.equal(mapAuthError({ code: "something_new" }), "generic");
    assert.equal(mapAuthError(null), "generic");
  });
});
