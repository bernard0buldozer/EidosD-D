import type { CharacterDefinition, CharacterSession } from "../domain/types";
import { Coins, Footprints, Heart, Minus, Plus, Shield } from "./Icons";
export function Vitals({
  character,
  core,
  defense,
  update,
}: {
  character: CharacterDefinition;
  core: CharacterSession;
  defense: number;
  update: (p: Partial<CharacterSession>) => void;
}) {
  return (
    <section className="vitals" aria-label="Показатели персонажа">
      <div className="vital defense">
        <span className="eyebrow">
          <Shield size={17} />
          Защита
        </span>
        <strong data-testid="defense">{defense}</strong>
        <span className="vital-note">от активной стойки</span>
      </div>
      <div className={`vital health ${core.hp === 0 ? "empty" : ""}`}>
        <span className="eyebrow">
          <Heart size={17} />
          Здоровье
        </span>
        <div className="hp-control">
          <button
            aria-label="Уменьшить здоровье"
            onClick={() => update({ hp: core.hp - 1 })}
            disabled={core.hp === 0}
          >
            <Minus size={19} />
          </button>
          <div>
            <strong data-testid="hp">{core.hp}</strong>
            <span> / {character.maxHp}</span>
          </div>
          <button
            aria-label="Увеличить здоровье"
            onClick={() => update({ hp: core.hp + 1 })}
            disabled={core.hp === character.maxHp}
          >
            <Plus size={19} />
          </button>
        </div>
        <div
          className="health-meter"
          role="progressbar"
          aria-label="Здоровье"
          aria-valuenow={core.hp}
          aria-valuemin={0}
          aria-valuemax={character.maxHp}
        >
          <span style={{ width: `${(core.hp / character.maxHp) * 100}%` }} />
        </div>
      </div>
      <div className="vital">
        <span className="eyebrow">
          <Footprints size={17} />
          Скорость
        </span>
        <strong>{character.speed.value}</strong>
        <span className="vital-note">{character.speed.unit}</span>
      </div>
      {character.resources.map((r) => (
        <div className="vital" key={r.id}>
          <span className="eyebrow">{r.name}</span>
          <strong>{r.maximum ?? "—"}</strong>
        </div>
      ))}
      <div className="vital wallet">
        <label className="eyebrow" htmlFor="wallet">
          <Coins size={17} />
          Кошелёк
        </label>
        <input
          id="wallet"
          value={core.wallet}
          onChange={(e) => update({ wallet: e.target.value })}
          maxLength={100}
          placeholder="—"
          aria-label="Кошелёк"
        />
        <span className="vital-note">свободная запись</span>
      </div>
    </section>
  );
}
