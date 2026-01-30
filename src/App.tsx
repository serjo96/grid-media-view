import "./App.css";
import "./components/components.css";
import { useMemo, useState } from "react";
import { UploadArea } from "./components/UploadArea";
import { StackList } from "./components/StackList";
import { GridPreview } from "./components/GridPreview/GridPreview";
import { CropModal } from "./components/CropModal";
import { useAppStore } from "./store/useAppStore";
import { TgChatView } from "./components/views/TgChatView";
import { AllGridsView } from "./components/views/AllGridsView";

function App() {
  const grids = useAppStore((s) => s.grids);
  const activeGridId = useAppStore((s) => s.activeGridId);
  const createGrid = useAppStore((s) => s.createGrid);
  const selectGrid = useAppStore((s) => s.selectGrid);

  const [viewMode, setViewMode] = useState<"single" | "tgChat" | "allGrids">("single");

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

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="title">Photo Grid Previewer</div>
            <div className="subtitle">Instagram (profile grid), Telegram album (up to 10), Custom</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

            <button className="btn btnDanger" type="button" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Files</div>
            <div className="panelHint">Drop images here</div>
          </div>
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
            <UploadArea />
            <div style={{ height: 12 }} />
            <StackList />

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
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">{previewTitle}</div>
            <div className="panelHint">{previewHint}</div>
          </div>
          <div className="panelBody">
            {viewMode === "single" && <GridPreview />}
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
          </div>
        </div>
      </div>

      <CropModal />
    </div>
  );
}

export default App;
