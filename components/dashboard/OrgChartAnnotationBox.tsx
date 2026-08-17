"use client";

import { useRef, useState } from "react";
import type { OrgChartAnnotation } from "@/lib/orgChart/cardConfig";

const BOX_W = 190;

// A free-floating sticky note on the org chart canvas — not attached to any
// position or person. Drag is deliberately a plain pointer-events
// implementation, separate from the @dnd-kit DndContext OrgChartView already
// runs for card reparenting: a note never has a "drop target" the way a
// dragged card does, it just moves to wherever the pointer released, so
// bolting it onto the reparent drag system would add sensors/collision
// logic for a case that doesn't need any of it. Position only commits to
// the parent (and therefore to config, and therefore to a saved view) on
// pointer-up — dragging itself is local state, so typing in one note isn't
// re-rendering every other note on every pixel of drag movement elsewhere.
export default function OrgChartAnnotationBox({
  annotation,
  onChangeText,
  onMove,
  onDelete,
  deleteLabel,
  placeholder,
}: {
  annotation: OrgChartAnnotation;
  onChangeText: (id: string, text: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  deleteLabel: string;
  placeholder: string;
}) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; boxX: number; boxY: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, boxX: annotation.x, boxY: annotation.y };
    setDragOffset({ x: 0, y: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    setDragOffset({ x: e.clientX - dragStart.current.pointerX, y: e.clientY - dragStart.current.pointerY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.pointerX;
    const dy = e.clientY - dragStart.current.pointerY;
    onMove(annotation.id, Math.max(0, dragStart.current.boxX + dx), Math.max(0, dragStart.current.boxY + dy));
    dragStart.current = null;
    setDragOffset(null);
  }

  const left = annotation.x + (dragOffset?.x ?? 0);
  const top = annotation.y + (dragOffset?.y ?? 0);

  return (
    <div style={{ position: "absolute", left, top, width: BOX_W, zIndex: dragOffset ? 30 : 5 }}>
      <div
        style={{
          background: "rgba(240,184,64,0.12)",
          border: "1px solid rgba(240,184,64,0.4)",
          borderRadius: 10,
          boxShadow: dragOffset ? "0 8px 20px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "3px 8px",
            cursor: dragOffset ? "grabbing" : "grab",
            borderBottom: "1px solid rgba(240,184,64,0.3)",
            touchAction: "none",
          }}
        >
          <span aria-hidden style={{ fontSize: 11, color: "var(--amber)", letterSpacing: 1 }}>
            ⠿⠿
          </span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(annotation.id)}
            aria-label={deleteLabel}
            style={{ background: "none", border: "none", color: "var(--amber)", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>
        <textarea
          className="no-print-border"
          value={annotation.text}
          onChange={(e) => onChangeText(annotation.id, e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            resize: "vertical",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 12.5,
            padding: 8,
            fontFamily: "inherit",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
