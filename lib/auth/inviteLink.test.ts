import { describe, expect, it } from "vitest";
import { buildSignupLink, isInviteToken } from "./inviteLink";

const ID = "3f2b8c1e-5a4d-4e9b-8c7a-1d2e3f4a5b6c";

describe("invitation sign-up link", () => {
  it("adds the invitation id when it is known", () => {
    expect(buildSignupLink("jane@company.com", ID)).toBe(`https://devometrics.com/signup?email=jane%40company.com&invite=${ID}`);
  });

  it("encodes the email address", () => {
    expect(buildSignupLink("a+b@company.com")).toBe("https://devometrics.com/signup?email=a%2Bb%40company.com");
  });

  it("leaves the id out when there is none, or it is not a valid id", () => {
    expect(buildSignupLink("jane@company.com")).toBe("https://devometrics.com/signup?email=jane%40company.com");
    expect(buildSignupLink("jane@company.com", null)).not.toContain("invite=");
    expect(buildSignupLink("jane@company.com", "not-an-id")).not.toContain("invite=");
    expect(buildSignupLink("jane@company.com", "x&evil=1")).not.toContain("evil");
  });

  it("recognises only real uuids as tokens", () => {
    expect(isInviteToken(ID)).toBe(true);
    expect(isInviteToken(ID.toUpperCase())).toBe(true);
    expect(isInviteToken("")).toBe(false);
    expect(isInviteToken(null)).toBe(false);
    expect(isInviteToken(`${ID}-extra`)).toBe(false);
    expect(isInviteToken("1; drop table organization_invites")).toBe(false);
  });
});
