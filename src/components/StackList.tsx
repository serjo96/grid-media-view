import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";

function fmtAspect(a: number) {
  if (!Number.isFinite(a) || a <= 0) return "—";
  return `${a.toFixed(3)} (w/h)`;
}

export function StackList() {
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
        <div key={it.id} className="stackItem">
          <div className="thumb">
            <img src={it.previewUrl} alt={it.fileName} draggable={false} />
          </div>

          <div className="stackMeta">
            <div className="stackName">
              {idx + 1}. {it.fileName} {it.kind === "video" ? "(video)" : ""}
            </div>
            <div className="stackSub">
              {it.width}×{it.height} • {fmtAspect(it.aspect)}
            </div>
          </div>

          <div className="stackActions">
            <button className="btn btnDanger" type="button" onClick={() => removeItem(it.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

