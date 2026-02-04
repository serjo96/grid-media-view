import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../store/useAppStore";
import { PresetId } from "../domain/layout/presets";
import { TELEGRAM_MAX_ITEMS } from "../domain/layout/constants";

interface UploadAreaProps {
  onDragStart?: () => void;
}

export function UploadArea({ onDragStart }: UploadAreaProps) {
  const addFiles = useAppStore((s) => s.addFiles);
  const preset = useAppStore((s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.preset ?? PresetId.Telegram);
  const itemsCount = useAppStore(
    (s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.items.length ?? 0,
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [canDrop, setCanDrop] = useState(() => {
    if (typeof window === "undefined") return true;
    // On touch devices the drop-zone UX is misleading; keep "Choose files" only.
    return window.innerWidth > 720;
  });

  // Track viewport changes (rotate / resize)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setCanDrop(window.innerWidth > 720);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const hint = useMemo(() => {
    if (preset === PresetId.Telegram) return `Telegram: максимум ${TELEGRAM_MAX_ITEMS} файлов в альбоме (сейчас ${itemsCount}).`;
    return `Можно загрузить сколько угодно (сейчас ${itemsCount}).`;
  }, [itemsCount, preset]);

  return (
    <div className="uploadArea">
      <div
        className={`uploadDrop ${isOver ? "uploadDropActive" : ""}`}
        onDragEnter={
          canDrop
            ? (e) => {
                e.preventDefault();
                setIsOver(true);
                onDragStart?.();
              }
            : undefined
        }
        onDragOver={
          canDrop
            ? (e) => {
                e.preventDefault();
                setIsOver(true);
              }
            : undefined
        }
        onDragLeave={canDrop ? () => setIsOver(false) : undefined}
        onDrop={
          canDrop
            ? async (e) => {
                e.preventDefault();
                setIsOver(false);
                if (e.dataTransfer?.files?.length) {
                  await addFiles(e.dataTransfer.files);
                }
              }
            : undefined
        }
      >
        <div className="uploadRow">
          <div>
            <div style={{ fontWeight: 650, fontSize: 13 }}>Загрузка файлов</div>
            <div className="uploadHint">{hint}</div>
          </div>
          <div className="uploadActions" style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                inputRef.current?.click();
              }}
            >
              Choose files
            </button>
          </div>
        </div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <div className="uploadFixedBar" role="region" aria-label="Upload actions">
            <button
              className="btn uploadFixedBtn"
              type="button"
              onClick={() => {
                inputRef.current?.click();
              }}
            >
              Choose files
            </button>
            <div className="uploadFixedHint">{hint}</div>
          </div>,
          document.body,
        )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
        onChange={async (e) => {
          if (e.target.files?.length) {
            await addFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

