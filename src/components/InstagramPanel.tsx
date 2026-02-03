import { useAppStore } from "../store/useAppStore";
import { PresetId } from "../domain/layout/presets";

function fmtTime(ts: number | null) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function InstagramPanel() {
  const preset = useAppStore((s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.preset ?? PresetId.Telegram);
  const ig = useAppStore((s) => s.instagram);
  const setToken = useAppStore((s) => s.setInstagramToken);
  const connect = useAppStore((s) => s.connectInstagram);
  const refresh = useAppStore((s) => s.refreshInstagram);
  const disconnect = useAppStore((s) => s.disconnectInstagram);
  const apply = useAppStore((s) => s.applyInstagramGridToActive);

  if (preset !== PresetId.Instagram) return null;

  const canApply = ig.media.length > 0;
  const isBusy = ig.status === "loading";

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 650, fontSize: 13 }}>Instagram</div>
      <div className="uploadHint">
        Подключение тут — <b>только демо</b>: вставьте свой access token (Basic Display API). Без авторизации загрузка файлов
        работает как обычно.
      </div>

      <label className="pill" style={{ justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Access token</span>
        <input
          className="select"
          style={{ width: 280 }}
          value={ig.token}
          placeholder="paste token…"
          onChange={(e) => setToken(e.target.value)}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => connect()} disabled={isBusy}>
          {ig.status === "connected" ? "Reconnect" : "Connect"}
        </button>
        <button className="btn" type="button" onClick={() => refresh()} disabled={isBusy || !ig.token.trim()}>
          Refresh
        </button>
        <button className="btn btnDanger" type="button" onClick={() => disconnect()} disabled={isBusy}>
          Disconnect
        </button>
        <button className="btn" type="button" onClick={() => apply()} disabled={!canApply}>
          Use my current IG grid
        </button>
      </div>

      <div className="uploadHint" style={{ marginTop: -2 }}>
        Status: <b>{ig.status}</b>
        {ig.profile?.username ? (
          <>
            {" "}
            • user: <b>@{ig.profile.username}</b>
          </>
        ) : null}
        {ig.lastFetchedAt ? (
          <>
            {" "}
            • updated: <b>{fmtTime(ig.lastFetchedAt)}</b>
          </>
        ) : null}
        {ig.media.length ? (
          <>
            {" "}
            • items: <b>{ig.media.length}</b>
          </>
        ) : null}
      </div>

      {ig.error ? (
        <div className="uploadHint" style={{ color: "rgba(255, 110, 120, 0.95)" }}>
          {ig.error}
        </div>
      ) : null}
    </div>
  );
}

