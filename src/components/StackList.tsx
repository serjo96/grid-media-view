import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";

function fmtAspect(a: number) {
  if (!Number.isFinite(a) || a <= 0) return "—";
  return `${a.toFixed(3)} (w/h)`;
}

export function StackList(props: {
  editMode: boolean;
  editTargetId: string | null;
  onRequestReplace: (itemId: string) => void;
}) {
  const { editMode, editTargetId, onRequestReplace } = props;
  const items = useAppStore(
    (s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.items ?? [],
  );
  const removeItem = useAppStore((s) => s.removeItem);

  const empty = useMemo(() => items.length === 0, [items.length]);

  if (empty) {
    return <div className="uploadHint">Добавьте 2–10 фото (для Telegram) или сколько нужно для других пресетов.</div>;
  }

  return (
    <div className="stack">
      {items.map((it, idx) => (
        <div
          key={it.id}
          className={`stackItem ${editMode && editTargetId === it.id ? "stackItemSelected" : ""}`}
        >
          <div className="thumb">
            <img src={it.previewUrl} alt={it.fileName} draggable={false} />
          </div>

          <div className="stackMeta">
            <div className="stackName">
              {idx + 1}. {it.fileName} {it.kind === "video" ? "(video)" : ""}{" "}
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                [{it.source === "instagram" ? "IG" : "local"}]
              </span>
              {editMode && editTargetId === it.id && (
                <span className="stackTag" style={{ marginLeft: 8 }}>
                  selected
                </span>
              )}
            </div>
            <div className="stackSub">
              {it.width}×{it.height} • {fmtAspect(it.aspect)}
            </div>
          </div>

          <div className="stackActions">
            {editMode && (
              <button className="btn" type="button" onClick={() => onRequestReplace(it.id)} aria-label={`Replace ${it.fileName}`}>
                <span className="btnIcon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0 0-3L16.5 4.5a2.121 2.121 0 0 0-3 0L3 15v5Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
                Replace
              </button>
            )}
            <button className="btn btnDanger" type="button" onClick={() => removeItem(it.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

