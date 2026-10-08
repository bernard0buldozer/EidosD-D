import { useRef, useState } from "react";
import { Shield, Upload } from "../components/Icons";
import type { StanceId } from "../mechanics/warrior/config";

/** Integration contract for a future animation adapter. No rigging or animation is attached. */
export type CharacterPresentationEvent =
  | { type: "stance"; stance: StanceId }
  | { type: "damage" | "heal"; amount: number }
  | { type: "attack" | "defense"; rollId?: string };
export interface CharacterPresentationProps {
  name: string;
  portrait: string | null;
  stance: StanceId;
  event: CharacterPresentationEvent | null;
  onPortraitChange: (portrait: string | null) => void;
  nickname: string;
  race: string;
  clan: string;
}
export function CharacterPresentation({
  name,
  portrait,
  stance,
  event,
  onPortraitChange,
  nickname,
  race,
  clan,
}: CharacterPresentationProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1000000
    ) {
      setError("Выберите утверждённый портрет PNG, JPEG или WebP до 1 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPortraitChange(reader.result);
        setError("");
      }
    };
    reader.onerror = () => setError("Не удалось прочитать портрет.");
    reader.readAsDataURL(file);
  };
  return (
    <div
      className="tilzit-presentation"
      data-stance={stance}
      data-character-event={event?.type}
    >
      <div className="tilzit-portrait-art">
        {portrait ? (
          <img src={portrait} alt={`Портрет: ${name}`} />
        ) : (
          <div className="tilzit-art-placeholder">
            <span className="eyebrow">Дом {clan || "не указан"}</span>
            <Shield size={104} strokeWidth={0.7} />
            <span className="portrait-motto">
              {nickname || "Прозвище не указано"}
            </span>
            <p>
              Место для утверждённой
              <br />
              иллюстрации Тильзита
            </p>
            <span className="tilzit-art-rule">✦</span>
          </div>
        )}
      </div>
      <div className="tilzit-portrait-caption">
        <span className="eyebrow">{name}</span>
        <p>{race || "Раса не указана"} · Мастер стоек</p>
        <button
          className="button secondary"
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          {portrait ? "Заменить портрет" : "Подключить портрет"}
        </button>
        {portrait && (
          <button
            className="text-button"
            onClick={() => onPortraitChange(null)}
          >
            Удалить портрет
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Файл портрета Тильзита"
          className="visually-hidden"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
