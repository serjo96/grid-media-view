import "./App.scss";
import "./components/components.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadArea } from "./components/UploadArea";
import { StackList } from "./components/StackList";
import { GridPreview } from "./components/GridPreview/GridPreview";
import { CropModal } from "./components/CropModal";
import { useAppStore } from "./store/useAppStore";
import { PresetId } from "./domain/layout/presets";
import { PRESET_WIDTH_CUSTOM_DEFAULT, ViewMode } from "./domain/layout/constants";
import { TgChatView } from "./components/views/TgChatView";
import { AllGridsView } from "./components/views/AllGridsView";
import { InstagramPanel } from "./components/InstagramPanel";
import { InstagramView } from "./components/views/InstagramView";

function App() {
  const grids = useAppStore((s) => s.grids);
  const activeGridId = useAppStore((s) => s.activeGridId);
  const createGrid = useAppStore((s) => s.createGrid);
  const selectGrid = useAppStore((s) => s.selectGrid);
  const deleteGrid = useAppStore((s) => s.deleteGrid);
  const replaceItemFile = useAppStore((s) => s.replaceItemFile);
  const hydrating = useAppStore((s) => s.persistence.hydrating);
  const canDelete = grids.length > 1;

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Single);
  const [editMode, setEditMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const editTargetIdRef = useRef<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  
  // Mobile accordion states
  const [filesPanelOpen, setFilesPanelOpen] = useState(() => {
    // On mobile, start closed; on desktop, start open
    if (typeof window !== "undefined") {
      return window.innerWidth > 980;
    }
    return true;
  });
  const [gridsSectionOpen, setGridsSectionOpen] = useState(false);
  const [customPresetOpen, setCustomPresetOpen] = useState(false);
  
  // Topbar visibility on mobile
  const [topbarVisible, setTopbarVisible] = useState(true);
  const lastScrollY = useRef(0);

  const activeGrid = useAppStore((s) => s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0]);

  const preset = activeGrid?.preset ?? PresetId.Telegram;
  const setPreset = useAppStore((s) => s.setPreset);
  const clear = useAppStore((s) => s.clear);
  const custom = activeGrid?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: PRESET_WIDTH_CUSTOM_DEFAULT };
  const setCustom = useAppStore((s) => s.setCustom);

  useEffect(() => {
    // Keep view controls simple:
    // - TG chat view only makes sense for Telegram preset.
    // - For other presets we silently fall back to single.
    if (preset !== PresetId.Telegram && viewMode === ViewMode.TgChat) {
      setViewMode(ViewMode.Single);
    }
  }, [preset, viewMode]);

  // Handle topbar visibility on scroll (mobile only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.innerWidth <= 720;
      
      if (isMobile) {
        // Show topbar when scrolling up, hide when scrolling down
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
          setTopbarVisible(false);
        } else if (currentScrollY < lastScrollY.current) {
          setTopbarVisible(true);
        }
      } else {
        setTopbarVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    const throttledHandleScroll = () => {
      requestAnimationFrame(handleScroll);
    };

    window.addEventListener("scroll", throttledHandleScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledHandleScroll);
  }, []);

  const previewTitle = useMemo(() => {
    if (viewMode === ViewMode.TgChat) return "Telegram chat";
    if (viewMode === ViewMode.AllGrids) return "All grids";
    return "Preview";
  }, [viewMode]);

  const previewHint = useMemo(() => {
    if (viewMode === ViewMode.TgChat) return "Scroll like a chat; each message is a grid preview";
    if (viewMode === ViewMode.AllGrids) return "All grids at once (click to open)";
    return "Grid/album layout + crop + reorder";
  }, [viewMode]);

  const effectiveEditTargetId = useMemo(() => {
    if (!editMode) return null;
    if (!editTargetId) return null;
    const exists = (activeGrid?.items ?? []).some((it) => it.id === editTargetId);
    return exists ? editTargetId : null;
  }, [activeGrid?.items, editMode, editTargetId]);

  useEffect(() => {
    // Keep a ref for the hidden <input> handler (avoid relying on async state).
    editTargetIdRef.current = effectiveEditTargetId;
  }, [effectiveEditTargetId]);

  const editTargetLabel = useMemo(() => {
    if (!editMode) return null;
    if (!effectiveEditTargetId) return "Select a photo to replace";
    const idx = (activeGrid?.items ?? []).findIndex((it) => it.id === effectiveEditTargetId);
    const it = idx >= 0 ? (activeGrid?.items ?? [])[idx] : null;
    if (!it) return "Select a photo to replace";
    return `Replacing #${idx + 1}: ${it.fileName}`;
  }, [activeGrid?.items, effectiveEditTargetId, editMode]);

  const requestReplace = (itemId: string) => {
    if (!editMode) return;
    setEditTargetId(itemId);
    editTargetIdRef.current = itemId;
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
      <div className={`topbar ${!topbarVisible ? "topbarHidden" : ""}`}>
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
                onChange={(e) => setPreset(e.target.value as PresetId)}
                aria-label="Preset"
              >
                <option value={PresetId.Telegram}>Telegram (album)</option>
                <option value={PresetId.Instagram}>Instagram (profile grid)</option>
                <option value={PresetId.Custom}>Custom</option>
              </select>
            </label>

            {preset === PresetId.Telegram && (
              <label className="pill">
                <span style={{ fontSize: 12, color: "var(--muted)" }}>View</span>
                <select
                  className="select"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  aria-label="View mode"
                >
                  <option value={ViewMode.Single}>Active grid</option>
                  <option value={ViewMode.TgChat}>TG chat</option>
                  <option value={ViewMode.AllGrids}>All grids</option>
                </select>
              </label>
            )}

            {preset === PresetId.Custom && (
              <div className="pill" aria-label="View mode">
                <span style={{ fontSize: 12, color: "var(--muted)" }}>View</span>
                <div className="viewToggle" role="group" aria-label="Custom view toggle">
                  <button
                    className={`btn viewToggleBtn ${viewMode === ViewMode.Single ? "btnToggleActive" : ""}`}
                    type="button"
                    onClick={() => setViewMode(ViewMode.Single)}
                    aria-pressed={viewMode === ViewMode.Single}
                    title="Active grid"
                  >
                    <span className="viewToggleIcon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6.5 6.5h11v11h-11z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="viewToggleText">Single</span>
                  </button>
                  <button
                    className={`btn viewToggleBtn ${viewMode === ViewMode.AllGrids ? "btnToggleActive" : ""}`}
                    type="button"
                    onClick={() => setViewMode(ViewMode.AllGrids)}
                    aria-pressed={viewMode === ViewMode.AllGrids}
                    title="All grids"
                  >
                    <span className="viewToggleIcon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="viewToggleText">All</span>
                  </button>
                </div>
              </div>
            )}

            <button
              className={`btn ${editMode ? "btnToggleActive" : ""}`}
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                setEditTargetId(null);
              }}
              aria-pressed={editMode}
              aria-label="Toggle edit mode"
              title="Edit mode (drag to reorder, replace photo)"
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
              Edit
            </button>

            {editMode && (
              <div className="pill" style={{ gap: 10, maxWidth: 360 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Replace</span>
                <span
                  style={{
                    fontSize: 12,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {editTargetLabel}
                </span>
                {effectiveEditTargetId && (
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={() => setEditTargetId(null)}
                    aria-label="Clear replace target"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="content">
        <div className={`filesPanel ${filesPanelOpen ? "filesPanelOpen" : "filesPanelClosed"}`}>
          <details 
            className="panel panelAccordion" 
            open={filesPanelOpen}
            onToggle={(e) => setFilesPanelOpen((e.target as HTMLDetailsElement).open)}
          >
          <summary className="panelHeader panelSummary" aria-label="Files panel">
            <div className="panelTitle">Files</div>
            <div className="panelHint">Drop images here</div>
            <div className="accordionChevron" aria-hidden="true" />
          </summary>
          <div className="panelBody">
            <details 
              className="filesSectionAccordion" 
              open={gridsSectionOpen}
              onToggle={(e) => setGridsSectionOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="filesSectionSummary">
                <div style={{ fontWeight: 650, fontSize: 13 }}>Grids</div>
                <button 
                  className="btn btnMobileOnly" 
                  type="button" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    createGrid();
                  }}
                  aria-label="Create new grid"
                >
                  Create new
                </button>
                <div className="accordionChevron" aria-hidden="true" />
              </summary>
              <div style={{ paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>Grids</div>
                  <button className="btn btnDesktopOnly" type="button" onClick={createGrid}>
                    Create new
                  </button>
                </div>
                <div style={{ height: 10 }} />
                <div style={{ display: "grid", gap: 8 }}>
                  {grids.map((g) => {
                    const active = g.id === activeGridId;
                    return (
                      <div
                        key={g.id}
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          gap: 0,
                          position: "relative",
                        }}
                      >
                        <button
                          type="button"
                          className="btn"
                          onClick={() => selectGrid(g.id)}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            borderTop: active ? "1px solid rgba(124, 92, 255, 0.55)" : undefined,
                            borderBottom: active ? "1px solid rgba(124, 92, 255, 0.55)" : undefined,
                            borderLeft: active ? "1px solid rgba(124, 92, 255, 0.55)" : undefined,
                            borderRight: canDelete ? "1px solid var(--border)" : active ? "1px solid rgba(124, 92, 255, 0.55)" : undefined,
                            background: active ? "rgba(124, 92, 255, 0.10)" : undefined,
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            marginRight: 0,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontWeight: 650 }}>{g.name}</span>
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>{g.items.length} files</span>
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                            preset: {g.preset === PresetId.Telegram ? "tg" : g.preset === PresetId.Instagram ? "inst" : "custom"}
                          </div>
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btnDanger"
                            onClick={() => deleteGrid(g.id)}
                            aria-label={`Delete ${g.name}`}
                            title="Delete grid"
                            style={{
                              padding: "8px 10px",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderTopLeftRadius: 0,
                              borderBottomLeftRadius: 0,
                              borderLeft: "none",
                              marginLeft: 0,
                            }}
                          >
                            <span className="btnIcon" aria-hidden="true" style={{ marginRight: 0 }}>
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
              </div>
            </details>

            <div style={{ paddingTop: 14, paddingBottom: 14 }}>
              <UploadArea onDragStart={() => {
                if (typeof window !== "undefined" && window.innerWidth <= 980) {
                  setFilesPanelOpen(true);
                }
              }} />
            </div>

            <details className="filesSectionAccordion" open>
              <summary className="filesSectionSummary">
                <div style={{ fontWeight: 650, fontSize: 13 }}>File list</div>
                <div className="accordionChevron" aria-hidden="true" />
              </summary>
              <div style={{ paddingTop: 12 }}>
                <StackList
                  editMode={editMode}
                  editTargetId={effectiveEditTargetId}
                  onRequestReplace={requestReplace}
                />
              </div>
            </details>
          </div>
        </details>

        {preset === PresetId.Instagram && (
          <div className="panel panelMobileHideWhenFilesCollapsed" style={{ marginTop: 16 }}>
            <div className="panelBody" style={{ padding: 12 }}>
              <InstagramPanel />
            </div>
          </div>
        )}

        {preset === PresetId.Custom && (
          <details 
            className="panel panelAccordion panelMobileHideWhenFilesCollapsed" 
            open={customPresetOpen}
            onToggle={(e) => setCustomPresetOpen((e.target as HTMLDetailsElement).open)}
            style={{ marginTop: 16 }}
          >
            <summary className="panelHeader panelSummary">
              <div className="panelTitle">Custom preset</div>
              <div className="accordionChevron" aria-hidden="true" />
            </summary>
            <div className="panelBody">
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
            </div>
          </details>
        )}
        </div>

        <div className="panel previewPanel">
          <div className="panelHeader panelHeaderSticky">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <div>
                <div className="panelTitle">
                  {viewMode === ViewMode.Single && activeGrid ? `${previewTitle}: ${activeGrid.name}` : previewTitle}
                </div>
                <div className="panelHint">{previewHint}</div>
              </div>
            </div>
            {viewMode === ViewMode.Single && (
              <div className="previewHeaderActions">
                {grids.length > 1 && (
                  <div className="gridNavButtons">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const currentIndex = grids.findIndex((g) => g.id === activeGridId);
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : grids.length - 1;
                        selectGrid(grids[prevIndex].id);
                      }}
                      aria-label="Previous grid"
                      title="Previous grid"
                    >
                      <span className="btnIcon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const currentIndex = grids.findIndex((g) => g.id === activeGridId);
                        const nextIndex = currentIndex < grids.length - 1 ? currentIndex + 1 : 0;
                        selectGrid(grids[nextIndex].id);
                      }}
                      aria-label="Next grid"
                      title="Next grid"
                    >
                      <span className="btnIcon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                  </div>
                )}
                {canDelete && (
                  <button
                    className="btn btnDanger"
                    type="button"
                    onClick={() => deleteGrid(activeGridId)}
                    aria-label={`Delete ${activeGrid?.name ?? "grid"}`}
                    title={`Delete ${activeGrid?.name ?? "grid"}`}
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
                {(activeGrid?.items.length ?? 0) > 0 && (
                  <button className="btn btnDanger" type="button" onClick={clear} aria-label="Clear grid">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="panelBody">
            {viewMode === ViewMode.Single &&
              (preset === PresetId.Instagram ? (
                <InstagramView
                  editMode={editMode}
                  editTargetId={effectiveEditTargetId}
                  onRequestReplace={requestReplace}
                  onScrollToInstagramPanel={() => {
                    // Открываем панель Files если она закрыта
                    if (!filesPanelOpen) {
                      setFilesPanelOpen(true);
                    }
                    // Ждем следующего кадра для рендера, затем скроллим
                    requestAnimationFrame(() => {
                      const panel = document.getElementById("instagram-panel");
                      if (panel) {
                        panel.scrollIntoView({ behavior: "smooth", block: "center" });
                        // Фокусируем поле ввода токена
                        const input = panel.querySelector('input[placeholder="paste token…"]') as HTMLInputElement;
                        if (input) {
                          setTimeout(() => input.focus(), 300);
                        }
                      }
                    });
                  }}
                />
              ) : (
                <GridPreview editMode={editMode} editTargetId={effectiveEditTargetId} onRequestReplace={requestReplace} />
              ))}
            {viewMode === ViewMode.TgChat && (
              <TgChatView
                grids={grids}
                activeGridId={activeGridId}
                onOpenGrid={(id) => {
                  selectGrid(id);
                  setViewMode(ViewMode.Single);
                }}
              />
            )}
            {viewMode === ViewMode.AllGrids && (
              <AllGridsView
                grids={grids}
                activeGridId={activeGridId}
                onOpenGrid={(id) => {
                  selectGrid(id);
                  setViewMode(ViewMode.Single);
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
          const id = editTargetIdRef.current;
          const f = e.target.files?.[0];
          if (id && f) {
            await replaceItemFile({ itemId: id, file: f });
            setEditTargetId(null);
          }
          e.target.value = "";
        }}
      />

      <CropModal />

    </div>
  );
}

export default App;
