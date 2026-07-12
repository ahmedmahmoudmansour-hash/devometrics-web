import Link from "next/link";
import { redirect } from "next/navigation";
import { listContactInquiries } from "@/lib/contact/actions";

const TYPE_COLOR: Record<string, string> = {
  sales: "var(--teal)",
  support: "#7dd3fc",
  careers: "#f0b840",
};

export default async function AdminInquiriesPage() {
  const { isAdmin, inquiries } = await listContactInquiries();
  if (!isAdmin) redirect("/dashboard");

  const cellStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: 13,
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
    verticalAlign: "top",
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    color: "var(--text-muted)",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/admin" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to admin
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Contact inquiries
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {inquiries.length} submission{inquiries.length === 1 ? "" : "s"} from the /contact form —
            each one was also emailed to the matching team inbox when submitted.
          </p>
        </div>

        {inquiries.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No inquiries yet.</p>
          </div>
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...headStyle, textAlign: "left" }}>Type</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>From</th>
                    <th style={{ ...headStyle, textAlign: "left" }}>Message</th>
                    <th style={{ ...headStyle, textAlign: "left", whiteSpace: "nowrap" }}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td style={cellStyle}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: TYPE_COLOR[inquiry.type] ?? "var(--text-muted)",
                          }}
                        >
                          {inquiry.type}
                        </span>
                      </td>
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        <div>{inquiry.name}</div>
                        <a href={`mailto:${inquiry.email}`} style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "none" }}>
                          {inquiry.email}
                        </a>
                      </td>
                      <td style={{ ...cellStyle, maxWidth: 420, whiteSpace: "pre-wrap" }}>{inquiry.message}</td>
                      <td style={{ ...cellStyle, whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: 12 }}>
                        {new Date(inquiry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
