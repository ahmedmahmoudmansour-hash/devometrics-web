import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubString } from "./scrub";

describe("scrubString", () => {
  it("removes email addresses", () => {
    expect(scrubString("insert failed for jane.doe+hr@acme-corp.co.uk (org 1)")).toBe("insert failed for [email] (org 1)");
  });

  it("removes JWTs and bearer tokens", () => {
    // Built from parts so the secret scanner does not flag this fixture.
    const jwt = ["eyJhbGciOiJIUzI1NiIs", "eyJzdWIiOiIxMjM0NTY3ODkw", "dBjftJeZ4CVPmB92K27uhbUJU1p1r"].join(".");
    expect(scrubString(`token ${jwt} rejected`)).toBe("token [token] rejected");
    expect(scrubString("Authorization: Bearer abcdef1234567890abcdef")).toBe("Authorization: Bearer [token]");
  });

  it("removes API keys", () => {
    expect(scrubString("key sk-ant-api03-AbCdEfGh1234 leaked")).toContain("[key]");
    expect(scrubString("resend re_abcdefghijklmnop1234")).toContain("[key]");
  });

  it("drops query strings from URLs (filters can carry emails or tokens)", () => {
    expect(scrubString("GET https://x.supabase.co/rest/v1/profiles?email=eq.a@b.com&select=id failed")).toBe(
      "GET https://x.supabase.co/rest/v1/profiles?[query] failed"
    );
  });

  it("leaves ordinary text alone", () => {
    expect(scrubString("Could not save the note")).toBe("Could not save the note");
  });
});

describe("scrubEvent", () => {
  const event = {
    message: "failed for sam@corp.com",
    user: { id: "u1", email: "sam@corp.com", ip_address: "10.0.0.1" },
    request: {
      url: "https://app.example/dashboard?token=abc",
      method: "POST",
      headers: { cookie: "sb-access-token=secret", authorization: "Bearer xyz" },
      cookies: { a: "b" },
      data: { salary: 120000 },
      query_string: "email=a@b.com",
    },
    exception: { values: [{ type: "Error", value: "no row for lee@corp.com" }] },
    breadcrumbs: [{ message: "fetch /x?email=a@b.com", data: { url: "https://h/y?z=1" } }],
    extra: { note: "ping boss@corp.com" },
  };

  const result = scrubEvent(event) as typeof event;

  it("drops the user entirely", () => {
    expect("user" in result).toBe(false);
  });

  it("drops cookies, headers, body and query string from the request", () => {
    expect(result.request).toEqual({ url: "https://app.example/dashboard?[query]", method: "POST" });
  });

  it("scrubs messages, exception values, breadcrumbs and extras", () => {
    expect(result.message).toBe("failed for [email]");
    expect(result.exception.values[0].value).toBe("no row for [email]");
    expect(result.breadcrumbs[0].data.url).toBe("https://h/y?[query]");
    expect(result.extra.note).toBe("ping [email]");
  });

  it("does not mutate its input", () => {
    expect(event.user.email).toBe("sam@corp.com");
    expect(event.request.data).toEqual({ salary: 120000 });
  });
});

describe("scrubBreadcrumb", () => {
  it("scrubs nested breadcrumb data", () => {
    const out = scrubBreadcrumb({ category: "fetch", data: { url: "https://h/rest?email=eq.a@b.com", note: "from a@b.com" } });
    expect(out.data.url).toBe("https://h/rest?[query]");
    expect(out.data.note).toBe("from [email]");
  });
});
