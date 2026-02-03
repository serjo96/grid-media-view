import type { GridState } from "../../store/useAppStore";
import { PresetId } from "../../domain/layout/presets";
import { PRESET_WIDTH_CUSTOM_DEFAULT } from "../../domain/layout/constants";
import { StaticGridPreview } from "../StaticGridPreview";
import { useAppStore } from "../../store/useAppStore";

function presetLabel(p: GridState["preset"]) {
  if (p === PresetId.Telegram) return "tg";
  if (p === PresetId.Instagram) return "inst";
  return "custom";
}

export function AllGridsView(props: {
  grids: GridState[];
  activeGridId: string;
  onOpenGrid: (gridId: string) => void;
}) {
  const { grids, activeGridId, onOpenGrid } = props;
  const deleteGrid = useAppStore((s) => s.deleteGrid);
  const canDelete = grids.length > 1;

  if (grids.length === 0) {
    return <div className="uploadHint">Нет гридов.</div>;
  }

  return (
    <div className="allGridsGrid" role="region" aria-label="All grids">
      {grids.map((g) => {
        const active = g.id === activeGridId;
        return (
          <div key={g.id} className={`gridCard ${active ? "gridCardActive" : ""}`}>
            <button
              type="button"
              className="gridCardButton"
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
              <StaticGridPreview grid={g} widthPx={PRESET_WIDTH_CUSTOM_DEFAULT} maxWidthPx={520} />
            </button>
            {canDelete && (
              <button
                type="button"
                className="btn btnDanger gridCardDelete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteGrid(g.id);
                }}
                aria-label={`Delete ${g.name}`}
                title="Delete grid"
              >
                <span className="btnIcon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

