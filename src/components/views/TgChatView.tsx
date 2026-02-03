import type { GridState } from "../../store/useAppStore";
import { PresetId } from "../../domain/layout/presets";
import { StaticGridPreview } from "../StaticGridPreview";
import { useAppStore } from "../../store/useAppStore";

function fmtTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TgChatView(props: {
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
    <div className="tgChatWindow" role="region" aria-label="Telegram chat preview">
      {grids.map((g) => {
        const active = g.id === activeGridId;
        return (
          <div key={g.id} className={`tgMsgRow ${active ? "tgMsgRowActive" : ""}`}>
            <div className="tgMsgBubbleWrapper">
              <button
                type="button"
                className="tgMsgBubble"
                onClick={() => onOpenGrid(g.id)}
                aria-label={`Open ${g.name}`}
              >
                <div className="tgMsgHeader">
                  <div className="tgMsgTitle">{g.name}</div>
                  <div className="tgMsgMeta">
                    {g.items.length} • {fmtTime(g.createdAt)}
                  </div>
                </div>

                <div className="tgMsgBody">
                  <StaticGridPreview grid={g} presetOverride={PresetId.Telegram} widthPx={320} maxWidthPx={340} className="tgBubblePreview" />
                </div>

                <div className="tgMsgFooter">{fmtTime(g.createdAt)}</div>
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="btn btnDanger tgMsgDelete"
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
          </div>
        );
      })}
    </div>
  );
}

