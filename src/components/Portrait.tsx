import { useRef, useState } from "react";
import type { CharacterSession } from "../domain/types";
import { Feather, Upload, X } from "./Icons";
export function Portrait({
  core,
  update,
}: {
  core: CharacterSession;
  update: (p: Partial<CharacterSession>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1000000
    ) {
      setError("Выберите PNG, JPEG или WebP до 1 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update({ portrait: reader.result });
        setError("");
      }
    };
    reader.onerror = () => setError("Не удалось прочитать изображение.");
    reader.readAsDataURL(file);
  };
  return (
    <aside className="portrait-column" aria-label="Портрет и заметки">
      <div className={`portrait-frame ${core.portrait ? "has-image" : ""}`}>
        {core.portrait ? (
          <img src={core.portrait} alt={`Портрет: ${core.name}`} />
        ) : (
          <div className="portrait-placeholder">
            <div className="crest-ring" />
            <svg
              className="warrior-crest"
              viewBox="0 0 240 300"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="metal" x2="1" y2="1">
                  <stop stopColor="#c8c1a3" />
                  <stop offset=".5" stopColor="#777e6c" />
                  <stop offset="1" stopColor="#c8b17f" />
                </linearGradient>
              </defs>
              <g stroke="#ccb98e" strokeWidth="2" fill="none">
                <path
                  d="M51 240 186 57 199 25 172 49 37 229Z"
                  fill="url(#metal)"
                />
                <path
                  d="m53 202 36 26m-31-12-29 39m-7-6 15 12"
                  strokeWidth="5"
                />
                <path
                  d="M184 240 49 57 36 25 63 49 198 229Z"
                  fill="url(#metal)"
                />
                <path
                  d="m182 202-36 26m31-12 29 39m7-6-15 12"
                  strokeWidth="5"
                />
                <path
                  d="M120 90 178 112v62c0 32-30 57-58 73-28-16-58-41-58-73v-62Z"
                  fill="#34453b"
                  strokeWidth="3"
                />
                <path d="M120 106 162 122v51c0 24-21 44-42 57-21-13-42-33-42-57v-51Z" />
                <path d="m120 127 20 37-20 44-20-44Z" fill="#b8a16b" />
                <path d="M120 118v100M96 164h48" />
              </g>
            </svg>
            <span className="portrait-label">Портрет персонажа</span>
            <span className="portrait-subtitle">PNG · JPEG · WebP</span>
          </div>
        )}
        <button
          className="portrait-upload"
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          {core.portrait ? "Заменить портрет" : "Добавить портрет"}
        </button>
        {core.portrait && (
          <button
            className="portrait-remove icon-button"
            aria-label="Удалить портрет"
            onClick={() => update({ portrait: null })}
          >
            <X size={16} />
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Файл портрета"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="identity-detail">
        <span className="eyebrow">Архетип</span>
        <h2>Мастер стоек</h2>
        <div className="thin-rule" />
      </div>
      <details className="notes panel">
        <summary>
          <Feather size={17} />
          Заметки персонажа
        </summary>
        <label className="visually-hidden" htmlFor="notes">
          Заметки персонажа
        </label>
        <textarea
          id="notes"
          value={core.notes}
          maxLength={4000}
          placeholder="Связи, цели, важное за столом…"
          onChange={(e) => update({ notes: e.target.value })}
        />
      </details>
      <details className="rules-note">
        <summary>Навыки и владения</summary>
        <p>
          Для этого Воина список навыков и бонусы владения пока не заданы.
          Броски характеристик используют только указанные модификаторы.
        </p>
      </details>
    </aside>
  );
}
