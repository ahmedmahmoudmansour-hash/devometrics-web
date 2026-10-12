import { describe, expect, it } from "vitest";
import { parseScormManifest } from "./manifest";
import { guessScormMimeType, SCORM_MIME_BY_EXTENSION } from "./constants";

const manifest12 = (extra = "") => `<?xml version="1.0"?>
<manifest identifier="m1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1">
    <organization identifier="org1"><title>T</title><item identifier="i1" identifierref="res2"><title>L</title></item></organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" href="other.html"/>
    <resource identifier="res2" type="webcontent" adlcp:scormtype="sco" href="./story.html"/>
  </resources>${extra}
</manifest>`;

describe("parseScormManifest", () => {
  it("accepts SCORM 1.2 and resolves the launch file via the first item's identifierref", () => {
    expect(parseScormManifest(manifest12())).toEqual({ version: "1.2", launchPath: "story.html" });
  });

  it("falls back to the first resource when there is no organization tree", () => {
    const xml = `<manifest><resources><resource identifier="r" href="index.html"/></resources></manifest>`;
    expect(parseScormManifest(xml)).toEqual({ version: "1.2", launchPath: "index.html" });
  });

  it("rejects SCORM 2004 by schemaversion", () => {
    const xml = manifest12().replace("<schemaversion>1.2</schemaversion>", "<schemaversion>2004 4th Edition</schemaversion>");
    expect(parseScormManifest(xml)).toHaveProperty("error");
  });

  it("rejects SCORM 2004 by namespace", () => {
    const xml = `<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"><resources><resource href="a.html"/></resources></manifest>`;
    expect(parseScormManifest(xml)).toHaveProperty("error");
  });

  it("rejects a document with no manifest root or no resources", () => {
    expect(parseScormManifest("<root/>")).toHaveProperty("error");
    expect(parseScormManifest("<manifest><resources/></manifest>")).toHaveProperty("error");
  });
});

describe("guessScormMimeType", () => {
  it("maps the schema files every SCORM 1.2 package carries to an allowed type", () => {
    // Regression: .xsd used to fall through to application/octet-stream, which
    // the storage bucket refused, so normal packages failed to import.
    expect(guessScormMimeType("adlcp_rootv1p2.xsd")).toBe("application/xml");
    expect(guessScormMimeType("imscp_rootv1p1p2.dtd")).toBe("application/xml");
  });

  it("covers common asset types", () => {
    expect(guessScormMimeType("a/b/index.HTML")).toBe("text/html");
    expect(guessScormMimeType("lib/player.js")).toBe("application/javascript");
    expect(guessScormMimeType("css/site.css")).toBe("text/css");
    expect(guessScormMimeType("img/pic.webp")).toBe("image/webp");
    expect(guessScormMimeType("fonts/f.ttf")).toBe("font/ttf");
    expect(guessScormMimeType("readme.txt")).toBe("text/plain");
  });

  it("falls back to octet-stream for unknown types", () => {
    expect(guessScormMimeType("blob.xyz")).toBe("application/octet-stream");
    expect(guessScormMimeType("noextension")).toBe("application/octet-stream");
  });

  it("only ever maps to a plausible MIME type string", () => {
    for (const [ext, mime] of Object.entries(SCORM_MIME_BY_EXTENSION)) {
      expect(ext).toMatch(/^[a-z0-9]+$/);
      expect(mime).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
    }
  });
});
