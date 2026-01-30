import type { GridState } from "../../store/useAppStore";
import { StaticGridPreview } from "../StaticGridPreview";

function presetLabel(p: GridState["preset"]) {
  if (p === "tg") return "tg";
  if (p === "inst") return "inst";
  return "custom";
}

export function AllGridsView(props: {
  grids: GridState[];
  activeGridId: string;
  onOpenGrid: (gridId: string) => void;
}) {
  const { grids, activeGridId, onOpenGrid } = props;

  if (grids.length === 0) {
    return <div className="uploadHint">Нет гридов.</div>;
  }

  return (
    <div className="allGridsGrid" role="region" aria-label="All grids">
      {grids.map((g) => {
        const active = g.id === activeGridId;
        return (
          <button
            key={g.id}
            type="button"
            className={`gridCard ${active ? "gridCardActive" : ""}`}
            onClick={() => onOpenGrid(g.id)}
            aria-label={`Open ${g.name}`}
          >
            <div className="gridCardHeader">
              <div className="gridCardTitle">{g.name}</div>
              <div className="gridCardMeta">
                <span className="gridCardTag">{presetLabel(g.preset)}</span>
                <span className="gridCardTag">{g.items.length}</span>
              </div>
            </div>
            <StaticGridPreview grid={g} widthPx={420} maxWidthPx={520} />
          </button>
        );
      })}
    </div>
  );
}

