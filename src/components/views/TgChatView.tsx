import type { GridState } from "../../store/useAppStore";
import { StaticGridPreview } from "../StaticGridPreview";

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

  if (grids.length === 0) {
    return <div className="uploadHint">Нет гридов.</div>;
  }

  return (
    <div className="tgChatWindow" role="region" aria-label="Telegram chat preview">
      {grids.map((g) => {
        const active = g.id === activeGridId;
        return (
          <div key={g.id} className={`tgMsgRow ${active ? "tgMsgRowActive" : ""}`}>
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
                <StaticGridPreview grid={g} presetOverride="tg" widthPx={320} maxWidthPx={340} className="tgBubblePreview" />
              </div>

              <div className="tgMsgFooter">{fmtTime(g.createdAt)}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

