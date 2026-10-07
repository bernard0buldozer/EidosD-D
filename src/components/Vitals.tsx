import type { CharacterSession } from "../domain/types";
import { NumberField } from "./Overlay";
export function Vitals({
  core,
  defense,
  update,
  smarchok = false,
  resource,
}: {
  core: CharacterSession;
  defense: number | null;
  update: (p: Partial<CharacterSession>) => void;
  smarchok?: boolean;
  resource?: React.ReactNode;
}) {
  return (
    <section className="vitals" aria-label="Показатели персонажа">
      <div className="vital defense">
        <span className="eyebrow">Защита{smarchok ? " · Туша" : ""}</span>
        <strong data-testid="defense">{defense ?? "—"}</strong>
        <span className="vital-note">
          {core.defense !== null
            ? "введена вручную"
            : smarchok
              ? "задайте в листе"
              : "от активной стойки"}
        </span>
      </div>
      <div className="vital health">
        <span className="eyebrow">Здоровье{smarchok ? " · Туша" : ""}</span>
        <div className="hp-control">
          <button
            aria-label="Уменьшить здоровье"
            disabled={core.hp === null || core.hp <= 0}
            onClick={() => update({ hp: core.hp! - 1 })}
          >
            −
          </button>
          <div>
            <strong data-testid="hp">{core.hp ?? "—"}</strong>
            <span> / {core.maxHp ?? "—"}</span>
          </div>
          <button
            aria-label="Увеличить здоровье"
            disabled={
              core.hp === null || core.maxHp === null || core.hp >= core.maxHp
            }
            onClick={() => update({ hp: core.hp! + 1 })}
          >
            +
          </button>
        </div>
        <span className="vital-note">
          {smarchok ? "Сам Смарчок: всегда 1 HP" : "Текущее / максимум"}
        </span>
      </div>
      <div className="vital speed">
        <NumberField
          label={smarchok ? "Скорость Туши" : "Скорость"}
          value={core.speed}
          onChange={(speed) => update({ speed })}
        />
        <span className="vital-note">клеток</span>
      </div>
      {resource}
      <div className="vital wallet">
        <label className="eyebrow" htmlFor="wallet">
          Кошелёк
        </label>
        <input
          id="wallet"
          value={core.wallet}
          onChange={(e) => update({ wallet: e.target.value })}
          placeholder="—"
        />
        <span className="vital-note">свободная запись</span>
      </div>
    </section>
  );
}
