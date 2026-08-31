import { XMLParser } from "fast-xml-parser";

export type ScormManifestInfo = {
  version: "1.2";
  launchPath: string;
};

// fast-xml-parser collapses a single repeated element to a bare object and
// only produces an array once there are 2+ — every place below that reads
// a repeatable element has to handle both shapes.
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Reads just enough of imsmanifest.xml to launch SCORM 1.2 content: the
// version signal (to reject 2004 packages — explicitly out of scope for
// this MVP) and the default organization's launch resource. Deliberately
// not a full SCORM manifest parser — no sequencing, no multi-SCO support,
// no prerequisites — matching the plan's "SCORM 1.2 only, no sequencing"
// scope.
export function parseScormManifest(xml: string): { error: string } | ScormManifestInfo {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return { error: "imsmanifest.xml is not valid XML." };
  }

  const manifest = doc?.manifest;
  if (!manifest) return { error: "imsmanifest.xml has no <manifest> root element." };

  // Version detection: the spec-correct <metadata><schemaversion> element
  // when present, falling back to the SCORM 1.2 vs. 2004 namespace URI
  // (adlcp_rootv1p2 vs. adlcp_v1p3) most real packages declare on
  // <manifest> even when they omit schemaversion.
  const schemaVersionRaw = String(manifest?.metadata?.schemaversion ?? "").trim();
  const namespaceAttrs = Object.keys(manifest)
    .filter((k) => k.startsWith("@_xmlns"))
    .map((k) => String(manifest[k]))
    .join(" ");
  const looks2004 = schemaVersionRaw.includes("2004") || namespaceAttrs.includes("v1p3") || namespaceAttrs.includes("2004");
  if (looks2004) {
    return { error: "This looks like a SCORM 2004 package — only SCORM 1.2 is supported right now." };
  }

  const resources = asArray(manifest?.resources?.resource);
  if (resources.length === 0) return { error: "imsmanifest.xml has no <resource> entries." };

  // Spec-correct resolution: the default (first) <organization>'s first
  // <item>'s identifierref names which <resource> to launch. Falls back to
  // the first resource in the manifest when that structure is missing or
  // incomplete — common in simple single-SCO packages that skip a real
  // organization tree.
  let targetIdentifier: string | null = null;
  const organizations = asArray(manifest?.organizations?.organization);
  const items = asArray(organizations[0]?.item);
  const identifierref = items[0]?.["@_identifierref"];
  if (typeof identifierref === "string" && identifierref.length > 0) targetIdentifier = identifierref;

  const resource = (targetIdentifier ? resources.find((r) => String(r?.["@_identifier"]) === targetIdentifier) : null) ?? resources[0];
  const href = resource?.["@_href"];
  if (typeof href !== "string" || href.length === 0) {
    return { error: "Could not find a launch file (resource href) in imsmanifest.xml." };
  }

  return { version: "1.2", launchPath: href.replace(/^\.\//, "") };
}
