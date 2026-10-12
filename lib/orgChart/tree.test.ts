import { describe, expect, it } from "vitest";
import { applyDepthCap, buildReportingForest, pruneForestForDisplay, wouldCreateCycle, type OrgChartNode } from "./tree";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const person = (userId: string, name: string, managerUserId: string | null): WorkforceRow =>
  ({ userId, name, managerUserId }) as unknown as WorkforceRow;

const ids = (nodes: OrgChartNode[]): string[] => nodes.flatMap((n) => [n.row.userId, ...ids(n.children)]);

describe("buildReportingForest", () => {
  it("builds a simple hierarchy with a sorted root", () => {
    const forest = buildReportingForest([
      person("c", "Cleo", "b"),
      person("a", "Ann", null),
      person("b", "Bo", "a"),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].row.userId).toBe("a");
    expect(forest[0].children[0].row.userId).toBe("b");
    expect(forest[0].children[0].children[0].row.userId).toBe("c");
  });

  it("treats someone whose manager is not on the roster as a root", () => {
    const forest = buildReportingForest([person("a", "Ann", "ghost"), person("b", "Bo", "a")]);
    expect(forest.map((n) => n.row.userId)).toEqual(["a"]);
  });

  it("never drops anyone caught in a closed reporting loop", () => {
    // a <-> b, plus a normal tree c -> d. Before the fix a and b vanished.
    const rows = [person("a", "Ann", "b"), person("b", "Bo", "a"), person("c", "Cy", null), person("d", "Di", "c")];
    const forest = buildReportingForest(rows);
    expect(new Set(ids(forest))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("shows each person exactly once even with a loop", () => {
    const rows = [person("a", "Ann", "b"), person("b", "Bo", "c"), person("c", "Cy", "a")];
    const all = ids(buildReportingForest(rows));
    expect(all.sort()).toEqual(["a", "b", "c"]);
  });

  it("treats a self-manager as a root", () => {
    expect(ids(buildReportingForest([person("a", "Ann", "a")]))).toEqual(["a"]);
  });
});

describe("wouldCreateCycle", () => {
  const managerBy = new Map<string, string | null>([
    ["b", "a"],
    ["c", "b"],
    ["a", null],
  ]);

  it("detects a loop through the chain", () => {
    expect(wouldCreateCycle("a", "c", managerBy)).toBe(true);
  });

  it("allows a valid reassignment", () => {
    expect(wouldCreateCycle("c", "a", managerBy)).toBe(false);
  });

  it("does not hang on a pre-existing corrupt chain", () => {
    const corrupt = new Map<string, string | null>([
      ["x", "y"],
      ["y", "x"],
    ]);
    expect(wouldCreateCycle("z", "x", corrupt)).toBe(false);
  });
});

describe("display transforms", () => {
  const forest = buildReportingForest([
    person("a", "Ann", null),
    person("b", "Bo", "a"),
    person("c", "Cy", "b"),
    person("d", "Di", "c"),
  ]);

  it("splices visible descendants up when an ancestor is filtered out", () => {
    const pruned = pruneForestForDisplay(forest, new Set(["a", "c", "d"]));
    expect(pruned[0].row.userId).toBe("a");
    expect(pruned[0].children.map((n) => n.row.userId)).toEqual(["c"]);
  });

  it("caps depth and flags hidden children", () => {
    const capped = applyDepthCap(forest, 2, new Set());
    expect(capped[0].children[0].row.userId).toBe("b");
    expect(capped[0].children[0].children).toHaveLength(0);
    expect(capped[0].children[0].hasHiddenChildren).toBe(true);
  });

  it("expands a branch past the cap", () => {
    const capped = applyDepthCap(forest, 2, new Set(["b"]));
    expect(capped[0].children[0].children[0].row.userId).toBe("c");
  });
});
