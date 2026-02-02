import { useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function UploadArea() {
  const addFiles = useAppStore((s) => s.addFiles);
  const preset = useAppStore((s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.preset ?? "tg");
  const itemsCount = useAppStore(
    (s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.items.length ?? 0,
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOver, setIsOver] = useState(false);

  const hint = useMemo(() => {
    if (preset === "tg") return `Telegram: максимум 10 файлов в альбоме (сейчас ${itemsCount}).`;
    return `Можно загрузить сколько угодно (сейчас ${itemsCount}).`;
  }, [itemsCount, preset]);

  return (
    <div className="uploadArea">
      <div
        className={`uploadDrop ${isOver ? "uploadDropActive" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsOver(false);
          if (e.dataTransfer?.files?.length) {
            await addFiles(e.dataTransfer.files);
          }
        }}
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
      </div>

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

