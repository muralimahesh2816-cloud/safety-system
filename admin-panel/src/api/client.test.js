import { isCredentialVerdictUrl } from "./client";

// A 401 from these means "that credential was wrong", so the response
// interceptor must surface it rather than refreshing the session and replaying
// the request. Replaying an OTP verification spends a second attempt against
// the account's lockout counter for every code the user mistypes.
describe("credential-verdict routes are never retried after a 401", () => {
  test.each([
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/otp/request",
    "/auth/otp/verify",
    "/auth/verify-otp",
    "/auth/resend-otp"
  ])("%s", (url) => {
    expect(isCredentialVerdictUrl(url)).toBe(true);
    expect(isCredentialVerdictUrl(`http://api.example.com/api/v1${url}`)).toBe(true);
  });
});

describe("session routes still refresh and replay on a 401", () => {
  test.each(["/auth/me", "/auth/csrf", "/work-approvals", "/hazards", "/notifications"])(
    "%s",
    (url) => {
      expect(isCredentialVerdictUrl(url)).toBe(false);
    }
  );
});

test("a missing url is not treated as a credential verdict", () => {
  expect(isCredentialVerdictUrl(undefined)).toBe(false);
  expect(isCredentialVerdictUrl("")).toBe(false);
});
