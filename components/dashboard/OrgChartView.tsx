"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { setMemberManager, setMemberManagerPosition, setPositionParent } from "@/lib/orgChart/actions";
import { createPosition, type OrgPositionRow } from "@/lib/orgChart/positions";
import { layout, flatten, subtreeWidth, wouldCreateCycle, CARD_W, CARD_H, LEVEL_H, type LayoutNode } from "@/lib/orgChart/tree";
import {
  buildMergedReportingForest,
  pruneMergedForestForDisplay,
  applyMergedDepthCap,
  buildMergedManagerEdgeMap,
  memberTag,
  positionTag,
  type MergedDisplayNode,
} from "@/lib/orgChart/mergedTree";
import { defaultViewConfig, DEFAULT_PRESET_KEY, type OrgChartViewConfig, type OrgChartPresetKey } from "@/lib/orgChart/cardConfig";
import { listSavedViews, type OrgChartSavedView } from "@/lib/orgChart/savedViews";
import OrgChartCard, { type DropState } from "@/components/dashboard/OrgChartCard";
import OrgChartPositionCard from "@/components/dashboard/OrgChartPositionCard";
import OrgChartPositionPanel from "@/components/dashboard/OrgChartPositionPanel";
import OrgChartControlBar from "@/components/dashboard/OrgChartControlBar";
import OrgChartToolsMenu from "@/components/dashboard/OrgChartToolsMenu";
import OrgChartExportBar from "@/components/dashboard/OrgChartExportBar";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const PAD = 40;

function matchesFilters(
  entity: { country: string | null; businessUnit: string | null; department: string | null },
  filters: OrgChartViewConfig["filters"]
): boolean {
  if (filters.countries.length > 0 && (!entity.country || !filters.countries.includes(entity.country))) return false;
  if (filters.businessUnits.length > 0 && (!entity.businessUnit || !filters.businessUnits.includes(entity.businessUnit))) return false;
  if (filters.departments.length > 0 && (!entity.department || !filters.departments.includes(entity.department))) return false;
  return true;
}

// Both cards emit drag/drop data keyed differently (OrgChartCard, untouched
// since Workstream 6, uses `userId`; OrgChartPositionCard, new this pass,
// uses an already-tagged `taggedId`) — this normalizes either shape into
// one tagged id (`member:<uuid>` / `position:<uuid>`) the rest of this
// file's merged-tree logic operates on.
function tagFromDragData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.taggedId === "string") return data.taggedId;
  if (typeof data.userId === "string") return memberTag(data.userId);
  return null;
}

function parseTag(tag: string): { kind: "member" | "position"; id: string } {
  const idx = tag.indexOf(":");
  return { kind: tag.slice(0, idx) as "member" | "position", id: tag.slice(idx + 1) };
}

export default function OrgChartView({
  rows,
  nominatedUserIds,
  positions,
  memberManagerPositions,
  organizationName,
}: {
  rows: WorkforceRow[];
  nominatedUserIds: string[];
  positions: OrgPositionRow[];
  // userId -> positionId, for members whose manager is currently a vacant
  // position rather than a real person. A plain object because it crosses
  // the server->client prop boundary (Maps don't serialize) — rebuilt into
  // a Map below.
  memberManagerPositions: Record<string, string>;
  organizationName: string;
}) {
  const t = useTranslations("orgChartView");
  const tPos = useTranslations("orgChartPositionCard");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [config, setConfig] = useState<OrgChartViewConfig>(defaultViewConfig());
  const [presetKey, setPresetKey] = useState<OrgChartPresetKey | null>(DEFAULT_PRESET_KEY);
  const [expandedBranchRootIds, setExpandedBranchRootIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<OrgChartSavedView[]>([]);
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<string, string | null>>(new Map());
  const [activeDragTag, setActiveDragTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenRows, setLastSeenRows] = useState(rows);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const nominatedSet = useMemo(() => new Set(nominatedUserIds), [nominatedUserIds]);
  const memberManagerPositionsMap = useMemo(() => new Map(Object.entries(memberManagerPositions)), [memberManagerPositions]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    listSavedViews().then(setSavedViews);
  }, []);

  // Clears optimistic patches once the server's real rows land (a fresh
  // `rows` reference after router.refresh()) — same "adjust state during
  // render" pattern as before (Workstream 6), not an effect, to avoid an
  // extra cascading render after commit.
  if (rows !== lastSeenRows) {
    setLastSeenRows(rows);
    setOptimisticOverrides(new Map());
  }

  const effectiveRows = useMemo(() => {
    if (optimisticOverrides.size === 0) return rows;
    return rows.map((r) => (optimisticOverrides.has(r.userId) ? { ...r, managerUserId: optimisticOverrides.get(r.userId) ?? null } : r));
  }, [rows, optimisticOverrides]);

  const mergedEdgeMap = useMemo(
    () => buildMergedManagerEdgeMap(effectiveRows, positions, memberManagerPositionsMap),
    [effectiveRows, positions, memberManagerPositionsMap]
  );

  const visibleIds = useMemo(() => {
    const hasAnyFilter = config.filters.countries.length > 0 || config.filters.businessUnits.length > 0 || config.filters.departments.length > 0;
    if (!hasAnyFilter) {
      return new Set([...effectiveRows.map((r) => memberTag(r.userId)), ...positions.map((p) => positionTag(p.id))]);
    }
    const visible = new Set<string>();
    for (const r of effectiveRows) if (matchesFilters(r, config.filters)) visible.add(memberTag(r.userId));
    for (const p of positions) if (matchesFilters(p, config.filters)) visible.add(positionTag(p.id));
    return visible;
  }, [effectiveRows, positions, config.filters]);

  const forest = useMemo(
    () => buildMergedReportingForest(effectiveRows, positions, memberManagerPositionsMap),
    [effectiveRows, positions, memberManagerPositionsMap]
  );
  const prunedForest = useMemo(() => pruneMergedForestForDisplay(forest, visibleIds), [forest, visibleIds]);
  const displayForest = useMemo(
    () => applyMergedDepthCap(prunedForest, config.maxDepth, expandedBranchRootIds),
    [prunedForest, config.maxDepth, expandedBranchRootIds]
  );

  const laidOutRoots = useMemo(() => {
    return displayForest.reduce<{ laidOut: LayoutNode<MergedDisplayNode>[]; cursor: number }>(
      (acc, root) => ({
        laidOut: [...acc.laidOut, layout(root, 0, acc.cursor)],
        cursor: acc.cursor + subtreeWidth(root) + 0.6,
      }),
      { laidOut: [], cursor: 0 }
    ).laidOut;
  }, [displayForest]);

  const allNodes = useMemo(() => laidOutRoots.flatMap((r) => flatten(r)), [laidOutRoots]);
  const maxX = Math.max(CARD_W, ...allNodes.map((n) => n.x)) + CARD_W;
  const maxY = Math.max(0, ...allNodes.map((n) => n.y)) + CARD_H;

  const selected = selectedId ? parseTag(selectedId) : null;
  const selectedMemberRow = selected?.kind === "member" ? effectiveRows.find((r) => r.userId === selected.id) ?? null : null;
  const selectedPosition = selected?.kind === "position" ? positions.find((p) => p.id === selected.id) ?? null : null;

  const dragged = activeDragTag ? parseTag(activeDragTag) : null;
  const draggedMemberRow = dragged?.kind === "member" ? effectiveRows.find((r) => r.userId === dragged.id) ?? null : null;
  const draggedPosition = dragged?.kind === "position" ? positions.find((p) => p.id === dragged.id) ?? null : null;

  function dropStateFor(taggedId: string): DropState {
    if (!activeDragTag || taggedId === activeDragTag) return "none";
    if (wouldCreateCycle(activeDragTag, taggedId, mergedEdgeMap)) return "invalid";
    return "valid";
  }

  // The one path unchanged from Workstream 6 — a real employee dragged
  // onto another real employee still writes through setMemberManager
  // exactly as it always has, with the same optimistic-patch/rollback
  // behavior.
  function applyReparent(employeeUserId: string, newManagerUserId: string | null) {
    setError(null);
    setOptimisticOverrides((prev) => new Map(prev).set(employeeUserId, newManagerUserId));
    startTransition(async () => {
      const result = await setMemberManager(employeeUserId, newManagerUserId);
      if (result && "error" in result) {
        setError(result.error);
        setOptimisticOverrides((prev) => {
          const next = new Map(prev);
          next.delete(employeeUserId);
          return next;
        });
      } else {
        router.refresh();
      }
    });
  }

  // The three new reparent shapes (member->position, position->member,
  // position->position) share one non-optimistic path — simpler than
  // extending the optimistic-override model to four shapes for what's a
  // less frequent interaction than everyday real-to-real reassignment.
  function applyMergedReparent(draggedTag: string, targetTag: string) {
    const d = parseTag(draggedTag);
    const target = parseTag(targetTag);
    if (d.kind === "member" && target.kind === "member") {
      applyReparent(d.id, target.id);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result =
        d.kind === "member"
          ? await setMemberManagerPosition(d.id, target.id)
          : await setPositionParent(d.id, target.kind === "position" ? target.id : null, target.kind === "member" ? target.id : null);
      if (result && "error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleMemberReportsToChange(employeeUserId: string, value: string) {
    if (!value) {
      applyReparent(employeeUserId, null);
      return;
    }
    const parsed = parseTag(value);
    if (parsed.kind === "member") {
      applyReparent(employeeUserId, parsed.id);
    } else {
      setError(null);
      startTransition(async () => {
        const result = await setMemberManagerPosition(employeeUserId, parsed.id);
        if (result && "error" in result) setError(result.error);
        else router.refresh();
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragTag(tagFromDragData(event.active.data.current as Record<string, unknown> | undefined));
  }

  function handleDragEnd(event: DragEndEvent) {
    const draggedTag = tagFromDragData(event.active.data.current as Record<string, unknown> | undefined);
    const targetTag = tagFromDragData(event.over?.data.current as Record<string, unknown> | undefined);
    setActiveDragTag(null);
    if (!draggedTag || !targetTag || draggedTag === targetTag) return;
    if (wouldCreateCycle(draggedTag, targetTag, mergedEdgeMap)) return; // client pre-check — server re-validates regardless
    applyMergedReparent(draggedTag, targetTag);
  }

  function handleConfigChange(nextConfig: OrgChartViewConfig, nextPresetKey: OrgChartPresetKey | null) {
    setConfig(nextConfig);
    setPresetKey(nextPresetKey);
    setExpandedBranchRootIds(new Set());
  }

  function handleApplySavedView(view: OrgChartSavedView) {
    const { presetKey: savedPresetKey, ...viewConfig } = view.config;
    setConfig(viewConfig);
    setPresetKey(savedPresetKey);
    setExpandedBranchRootIds(new Set());
  }

  function handleAddPosition(kind: "vacant_role" | "structural") {
    setError(null);
    startTransition(async () => {
      const result = await createPosition({ kind, title: kind === "vacant_role" ? t("newVacantRoleTitle") : t("newStructuralTitle") });
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  // A dedicated, one-click department picker — same underlying mechanism
  // as the generic department filter chips in OrgChartControlBar (both
  // write to config.filters.departments), just surfaced as the first thing
  // on the page instead of buried inside the control bar's filter section,
  // per Ahmed's explicit ask for a direct "pick a department" chart rather
  // than routing through Saved Views. Deliberately single-select (unlike
  // the control bar's multiselect chips) — picking "Sales" here replaces
  // the department filter outright rather than adding to it.
  function handleDepartmentChartChange(department: string) {
    handleConfigChange({ ...config, filters: { ...config.filters, departments: department ? [department] : [] } }, presetKey);
  }

  const departmentChartOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of effectiveRows) if (r.department) set.add(r.department);
    for (const p of positions) if (p.department) set.add(p.department);
    return [...set].sort();
  }, [effectiveRows, positions]);

  const isSingleDepartmentActive = config.filters.departments.length === 1;

  return (
    <div>
      {departmentChartOptions.length > 0 && (
        <div className="no-print" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            {t("departmentChartLabel")}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleDepartmentChartChange("")} style={departmentChipStyle(config.filters.departments.length === 0)}>
              {t("departmentChartAll")}
            </button>
            {departmentChartOptions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDepartmentChartChange(d)}
                style={departmentChipStyle(isSingleDepartmentActive && config.filters.departments[0] === d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <OrgChartControlBar rows={effectiveRows} config={config} activePresetKey={presetKey} onChange={handleConfigChange} />

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button type="button" disabled={isPending} onClick={() => setAddMenuOpen((v) => !v)} style={addPositionButtonStyle()}>
              {t("addPositionMenu")} {addMenuOpen ? "▴" : "▾"}
            </button>
            {addMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  zIndex: 25,
                  minWidth: 180,
                  background: "var(--navy-mid)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 6,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setAddMenuOpen(false);
                    handleAddPosition("vacant_role");
                  }}
                  style={addPositionMenuItemStyle()}
                >
                  {t("addVacantRole")}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setAddMenuOpen(false);
                    handleAddPosition("structural");
                  }}
                  style={addPositionMenuItemStyle()}
                >
                  {t("addStructural")}
                </button>
              </div>
            )}
          </div>
          <OrgChartToolsMenu
            savedViews={savedViews}
            currentConfig={config}
            currentPresetKey={presetKey}
            onApply={handleApplySavedView}
            onSaved={() => listSavedViews().then(setSavedViews)}
            organizationName={organizationName}
          />
        </div>
        <OrgChartExportBar />
      </div>

      {error && <p className="no-print" style={{ color: "#f87171", fontSize: 12.5, marginBottom: 8 }}>{error}</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="print-plan" style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 16, background: "var(--navy-mid)" }}>
          <div style={{ position: "relative", width: maxX + PAD * 2, height: maxY + PAD * 2 }}>
            <svg width={maxX + PAD * 2} height={maxY + PAD * 2} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <g transform={`translate(${PAD}, ${PAD})`}>
                {allNodes.map((n) =>
                  n.children.length > 0 ? (
                    <g key={`edges-${n.node.id}`} stroke="var(--border)" strokeWidth={1.5} fill="none">
                      {(() => {
                        const busY = n.y + CARD_H + (LEVEL_H - CARD_H) / 2;
                        const firstX = n.children[0].x;
                        const lastX = n.children[n.children.length - 1].x;
                        return (
                          <>
                            <line x1={n.x} y1={n.y + CARD_H} x2={n.x} y2={busY} />
                            {n.children.length > 1 && <line x1={firstX} y1={busY} x2={lastX} y2={busY} />}
                            {n.children.map((c) => (
                              <line key={c.node.id} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
                            ))}
                          </>
                        );
                      })()}
                    </g>
                  ) : null
                )}
              </g>
            </svg>

            <div style={{ position: "absolute", left: PAD, top: PAD }}>
              {allNodes.map((n) => (
                <div key={n.node.id} style={{ position: "absolute", left: n.x - CARD_W / 2, top: n.y }}>
                  {n.node.kind === "member" ? (
                    <OrgChartCard
                      row={n.node.row}
                      toggles={config.toggles}
                      density={config.density}
                      hasHiddenChildren={n.node.hasHiddenChildren}
                      isSuccessionCandidate={nominatedSet.has(n.node.row.userId)}
                      isSelected={n.node.id === selectedId}
                      dropState={dropStateFor(n.node.id)}
                      onSelect={(userId) => {
                        setSelectedId(memberTag(userId));
                        setError(null);
                      }}
                      onExpandBranch={(userId) =>
                        setExpandedBranchRootIds((prev) => new Set(prev).add(memberTag(userId)))
                      }
                    />
                  ) : (
                    <OrgChartPositionCard
                      position={n.node.position}
                      toggles={config.toggles}
                      density={config.density}
                      hasHiddenChildren={n.node.hasHiddenChildren}
                      isSelected={n.node.id === selectedId}
                      dropState={dropStateFor(n.node.id)}
                      onSelect={(id) => {
                        setSelectedId(positionTag(id));
                        setError(null);
                      }}
                      onExpandBranch={(id) => setExpandedBranchRootIds((prev) => new Set(prev).add(positionTag(id)))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {draggedMemberRow ? (
            <div style={{ opacity: 0.9 }}>
              <OrgChartCard
                row={draggedMemberRow}
                toggles={config.toggles}
                density={config.density}
                hasHiddenChildren={false}
                isSuccessionCandidate={nominatedSet.has(draggedMemberRow.userId)}
                isSelected={false}
                dropState="none"
                onSelect={() => {}}
                onExpandBranch={() => {}}
              />
            </div>
          ) : draggedPosition ? (
            <div style={{ opacity: 0.9 }}>
              <OrgChartPositionCard
                position={draggedPosition}
                toggles={config.toggles}
                density={config.density}
                hasHiddenChildren={false}
                isSelected={false}
                dropState="none"
                onSelect={() => {}}
                onExpandBranch={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {laidOutRoots.length > 1 && (
        <p className="no-print" style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
          {t("separateTreesNote", { count: laidOutRoots.length })}
        </p>
      )}

      {selectedMemberRow && (
        <div className="no-print" style={{ marginTop: 16, background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{selectedMemberRow.name}</span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {t("close")}
            </button>
          </div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("reportsTo")}</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              disabled={isPending}
              value={
                selectedMemberRow.managerUserId
                  ? `member:${selectedMemberRow.managerUserId}`
                  : memberManagerPositionsMap.get(selectedMemberRow.userId)
                    ? `position:${memberManagerPositionsMap.get(selectedMemberRow.userId)}`
                    : ""
              }
              onChange={(e) => handleMemberReportsToChange(selectedMemberRow.userId, e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                cursor: "pointer",
                minWidth: 220,
              }}
            >
              <option value="">{t("noManagerOption")}</option>
              {effectiveRows
                .filter((r) => r.userId !== selectedMemberRow.userId)
                .map((r) => (
                  <option key={`member:${r.userId}`} value={`member:${r.userId}`}>
                    {r.name}
                    {r.title ? ` — ${r.title}` : ""}
                  </option>
                ))}
              {positions.map((p) => (
                <option key={`position:${p.id}`} value={`position:${p.id}`}>
                  {p.title} ({p.kind === "structural" ? tPos("kindStructural") : tPos(`status_${p.status}`)})
                </option>
              ))}
            </select>
            {isPending && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("saving")}</span>}
          </div>
        </div>
      )}

      {selectedPosition && (
        <OrgChartPositionPanel position={selectedPosition} rows={effectiveRows} positions={positions} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function addPositionButtonStyle(): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function addPositionMenuItemStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    borderRadius: 6,
    color: "var(--text)",
    padding: "8px 10px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function departmentChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 13px",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 999,
    border: active ? "1px solid var(--teal)" : "1px solid var(--border)",
    background: active ? "var(--teal)" : "transparent",
    color: active ? "#0A0F1E" : "var(--text-muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
