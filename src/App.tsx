import "./App.css";
import "./components/components.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadArea } from "./components/UploadArea";
import { StackList } from "./components/StackList";
import { GridPreview } from "./components/GridPreview/GridPreview";
import { CropModal } from "./components/CropModal";
import { useAppStore } from "./store/useAppStore";
import { TgChatView } from "./components/views/TgChatView";
import { AllGridsView } from "./components/views/AllGridsView";
import { InstagramPanel } from "./components/InstagramPanel";
import { InstagramView } from "./components/views/InstagramView";

function App() {
  const grids = useAppStore((s) => s.grids);
  const activeGridId = useAppStore((s) => s.activeGridId);
  const createGrid = useAppStore((s) => s.createGrid);
  const selectGrid = useAppStore((s) => s.selectGrid);
  const replaceItemFile = useAppStore((s) => s.replaceItemFile);
  const hydrating = useAppStore((s) => s.persistence.hydrating);

  const [viewMode, setViewMode] = useState<"single" | "tgChat" | "allGrids">("single");
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const activeGrid = useAppStore((s) => s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0]);

  const preset = activeGrid?.preset ?? "tg";
  const setPreset = useAppStore((s) => s.setPreset);
  const clear = useAppStore((s) => s.clear);
  const custom = activeGrid?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: 420 };
  const setCustom = useAppStore((s) => s.setCustom);

  const previewTitle = useMemo(() => {
    if (viewMode === "tgChat") return "Telegram chat";
    if (viewMode === "allGrids") return "All grids";
    return "Preview";
  }, [viewMode]);

  const previewHint = useMemo(() => {
    if (viewMode === "tgChat") return "Scroll like a chat; each message is a grid preview";
    if (viewMode === "allGrids") return "All grids at once (click to open)";
    return "Grid/album layout + crop + reorder";
  }, [viewMode]);

  const effectiveReplaceTargetId = useMemo(() => {
    if (!replaceMode) return null;
    if (!replaceTargetId) return null;
    const exists = (activeGrid?.items ?? []).some((it) => it.id === replaceTargetId);
    return exists ? replaceTargetId : null;
  }, [activeGrid?.items, replaceMode, replaceTargetId]);

  useEffect(() => {
    // Keep a ref for the hidden <input> handler (avoid relying on async state).
    replaceTargetIdRef.current = effectiveReplaceTargetId;
  }, [effectiveReplaceTargetId]);

  const replaceTargetLabel = useMemo(() => {
    if (!replaceMode) return null;
    if (!effectiveReplaceTargetId) return "Select a photo to replace";
    const idx = (activeGrid?.items ?? []).findIndex((it) => it.id === effectiveReplaceTargetId);
    const it = idx >= 0 ? (activeGrid?.items ?? [])[idx] : null;
    if (!it) return "Select a photo to replace";
    return `Replacing #${idx + 1}: ${it.fileName}`;
  }, [activeGrid?.items, effectiveReplaceTargetId, replaceMode]);

  const requestReplace = (itemId: string) => {
    if (!replaceMode) return;
    setReplaceTargetId(itemId);
    replaceTargetIdRef.current = itemId;
    // Defer click to ensure state updates don't race with the input handler.
    queueMicrotask(() => replaceInputRef.current?.click());
  };

  return (
    <div className="app">
      {hydrating && (
        <div className="appLoaderOverlay" role="status" aria-live="polite" aria-label="Loading saved grids">
          <div className="appLoaderCard">
            <div className="appSpinner" aria-hidden="true" />
            <div style={{ fontWeight: 650, fontSize: 13 }}>Восстанавливаем сетки…</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Читаем файлы из локального хранилища</div>
          </div>
        </div>
      )}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="title">Photo Grid Previewer</div>
            <div className="subtitle">Instagram (profile grid), Telegram album (up to 10), Custom</div>
          </div>

          <div className="topbarControls">
            <label className="pill">
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Preset</span>
              <select
                className="select"
                value={preset}
                onChange={(e) => setPreset(e.target.value as typeof preset)}
                aria-label="Preset"
              >
                <option value="tg">Telegram (album)</option>
                <option value="inst">Instagram (profile grid)</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="pill">
              <span style={{ fontSize: 12, color: "var(--muted)" }}>View</span>
              <select
                className="select"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
                aria-label="View mode"
              >
                <option value="single">Active grid</option>
                <option value="tgChat">TG chat</option>
                <option value="allGrids">All grids</option>
              </select>
            </label>

            <button
              className={`btn ${replaceMode ? "btnToggleActive" : ""}`}
              type="button"
              onClick={() => {
                setReplaceMode((v) => !v);
                setReplaceTargetId(null);
              }}
              aria-pressed={replaceMode}
              aria-label="Toggle replace mode"
              title="Replace mode (like Telegram)"
            >
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

            {replaceMode && (
              <div className="pill" style={{ gap: 10, maxWidth: 360 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Edit</span>
                <span
                  style={{
                    fontSize: 12,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {replaceTargetLabel}
                </span>
                {effectiveReplaceTargetId && (
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={() => setReplaceTargetId(null)}
                    aria-label="Clear replace target"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            <button className="btn btnDanger" type="button" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="content">
        <details className="panel panelAccordion" open>
          <summary className="panelHeader panelSummary" aria-label="Files panel">
            <div className="panelTitle">Files</div>
            <div className="panelHint">Drop images here</div>
            <div className="accordionChevron" aria-hidden="true" />
          </summary>
          <div className="panelBody">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 650, fontSize: 13 }}>Grids</div>
              <button className="btn" type="button" onClick={createGrid}>
                Create new
              </button>
            </div>
            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gap: 8 }}>
              {grids.map((g) => {
                const active = g.id === activeGridId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="btn"
                    onClick={() => selectGrid(g.id)}
                    style={{
                      textAlign: "left",
                      borderColor: active ? "rgba(124, 92, 255, 0.55)" : undefined,
                      background: active ? "rgba(124, 92, 255, 0.10)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontWeight: 650 }}>{g.name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{g.items.length} files</span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      preset: {g.preset === "tg" ? "tg" : g.preset === "inst" ? "inst" : "custom"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ height: 14 }} />
            <InstagramPanel />
            {preset === "inst" && <div style={{ height: 14 }} />}
            <UploadArea />
            <div style={{ height: 12 }} />
            <StackList
              replaceMode={replaceMode}
              replaceTargetId={effectiveReplaceTargetId}
              onRequestReplace={requestReplace}
            />

            {preset === "custom" && (
              <>
                <div style={{ height: 12 }} />
                <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 8 }}>Custom preset</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <label className="pill" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Columns</span>
                    <input
                      className="select"
                      style={{ width: 120 }}
                      type="number"
                      min={1}
                      max={8}
                      value={custom.columns}
                      onChange={(e) => setCustom({ columns: Number(e.target.value) })}
                    />
                  </label>
                  <label className="pill" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Tile aspect (w/h)</span>
                    <input
                      className="select"
                      style={{ width: 120 }}
                      type="number"
                      min={0.1}
                      step={0.01}
                      value={custom.tileAspect}
                      onChange={(e) => setCustom({ tileAspect: Number(e.target.value) })}
                    />
                  </label>
                  <label className="pill" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Gap (px)</span>
                    <input
                      className="select"
                      style={{ width: 120 }}
                      type="number"
                      min={0}
                      max={40}
                      value={custom.gap}
                      onChange={(e) => setCustom({ gap: Number(e.target.value) })}
                    />
                  </label>
                  <label className="pill" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Preview width (px)</span>
                    <input
                      className="select"
                      style={{ width: 120 }}
                      type="number"
                      min={240}
                      max={1200}
                      value={custom.containerWidth}
                      onChange={(e) => setCustom({ containerWidth: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </details>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">{previewTitle}</div>
            <div className="panelHint">{previewHint}</div>
          </div>
          <div className="panelBody">
            {viewMode === "single" &&
              (preset === "inst" ? (
                <InstagramView
                  replaceMode={replaceMode}
                  replaceTargetId={effectiveReplaceTargetId}
                  onRequestReplace={requestReplace}
                />
              ) : (
                <GridPreview replaceMode={replaceMode} replaceTargetId={effectiveReplaceTargetId} onRequestReplace={requestReplace} />
              ))}
            {viewMode === "tgChat" && (
              <TgChatView
                grids={grids}
                activeGridId={activeGridId}
                onOpenGrid={(id) => {
                  selectGrid(id);
                  setViewMode("single");
                }}
              />
            )}
            {viewMode === "allGrids" && (
              <AllGridsView
                grids={grids}
                activeGridId={activeGridId}
                onOpenGrid={(id) => {
                  selectGrid(id);
                  setViewMode("single");
                }}
              />
            )}
            <div className="mobileBottomSpacer" aria-hidden="true" />
          </div>
        </div>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const id = replaceTargetIdRef.current;
          const f = e.target.files?.[0];
          if (id && f) {
            await replaceItemFile({ itemId: id, file: f });
            setReplaceTargetId(null);
          }
          e.target.value = "";
        }}
      />

      <CropModal />
    </div>
  );
}

export default App;
