import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real Sentry SDK with our real options against a local HTTP server
// standing in for Sentry, and inspects the bytes that would have left the app.
// This is the guarantee that matters for an HR product: whatever the SDK
// captures, personal data and credentials do not reach the tracker.
describe("error monitoring: what actually leaves the app", () => {
  const received: string[] = [];
  let server: Server;
  let Sentry: typeof import("@sentry/nextjs");

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        let body = Buffer.concat(chunks);
        try {
          if (req.headers["content-encoding"] === "gzip") body = gunzipSync(body);
        } catch {
          // already plain
        }
        received.push(body.toString("utf8"));
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    process.env.NEXT_PUBLIC_SENTRY_DSN = `http://testpublickey@127.0.0.1:${port}/1`;
    Sentry = await import("@sentry/nextjs");
    const { sharedSentryOptions } = await import("@/lib/monitoring/sentryOptions");
    Sentry.init({ ...sharedSentryOptions(), integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })] });
  });

  afterAll(async () => {
    await Sentry?.close(2000);
    await new Promise((resolve) => server?.close(resolve));
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("is enabled when a DSN is configured and sends events", async () => {
    Sentry.captureMessage("monitoring smoke test");
    await Sentry.flush(5000);
    expect(received.join("\n")).toContain("monitoring smoke test");
  });

  it("scrubs emails, tokens, user identity and request data from an exception", async () => {
    received.length = 0;
    // Built at runtime: a stack frame also ships the source lines around the
    // error, which in a test would be these very literals.
    const email = ["jane.doe", "corp.com"].join("@");
    const userEmail = ["leak", "corp.com"].join("@");
    const noteEmail = ["boss", "corp.com"].join("@");
    const victim = ["victim", "corp.com"].join("@");
    const token = ["abcdef", "1234567890", "abcdef"].join("");
    const ip = ["10", "1", "2", "3"].join(".");

    Sentry.getCurrentScope().setUser({ id: "u-1", email: userEmail, ip_address: ip });
    Sentry.getCurrentScope().setExtra("note", `contact ${noteEmail}`);
    Sentry.addBreadcrumb({
      category: "fetch",
      message: `GET https://x.supabase.co/rest/v1/profiles?email=eq.${victim}`,
      data: { url: `https://x.supabase.co/rest/v1/profiles?email=eq.${victim}` },
    });
    Sentry.captureException(new Error(`save failed for ${email} using Bearer ${token}`));
    await Sentry.flush(5000);

    const payload = received.join("\n");
    expect(payload).toContain("save failed for [email] using Bearer [token]");
    for (const secret of [email, token, userEmail, ip, noteEmail, victim]) {
      expect(payload, "payload leaked a secret").not.toContain(secret);
    }
    Sentry.getCurrentScope().setUser(null);
  });

  it("captures handled console.error calls (server actions log instead of throwing) and scrubs them", async () => {
    received.length = 0;
    const who = ["someone", "corp.com"].join("@");
    console.error(`checkAndConsumeInvite: lookup failed for ${who}`, new Error("boom"));
    await Sentry.flush(5000);
    const payload = received.join("\n");
    expect(payload).toContain("checkAndConsumeInvite");
    expect(payload).not.toContain(who);
  });
});
