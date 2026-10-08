import { useState } from "react";
import {
  ArrowRight,
  Check,
  Dices,
  Shield,
  Sword,
  Swords,
  X,
} from "../../components/Icons";
import { SectionTitle } from "../../components/SectionTitle";
import { rollSummary, signed } from "../../domain/dice";
import type { SheetController } from "../../state/useSheet";
import { stances } from "./config";
import { canAttack, type PendingAttack } from "./rules";
import { parseDamage } from "../../tilzit/rolls";
export function AttackPanel({ game }: { game: SheetController }) {
  const state = game.state.mechanic;
  const stance = stances[state.stance];
  const weapon =
    game.state.core.tilzit?.weapons[
      stance.id === "shield" ? "shield" : "sword"
    ];
  const available = canAttack(state, "main") && !game.rolling;
  return (
    <section className="attacks panel" id="attacks">
      <SectionTitle
        title="Атаки"
        icon={<Swords size={19} />}
        trailing={<span className="hint">{stance.equipment}</span>}
      />
      <div className="attack-table" role="table" aria-label="Доступные атаки">
        <div className="attack-head" role="row">
          <span role="columnheader">Название</span>
          <span role="columnheader">Бонус</span>
          <span role="columnheader">Урон</span>
          <span role="columnheader">Тип</span>
        </div>
        <div className="attack-row" role="row">
          <div role="cell">
            <button
              className="attack-button"
              disabled={!available}
              onClick={() => game.attack("main")}
              aria-label={`Бросить: ${stance.attackName}`}
            >
              {stance.id === "shield" ? (
                <Shield size={23} />
              ) : (
                <Sword size={23} />
              )}
              <span>
                <strong>{stance.id === "shield" ? "Щит" : "Меч"}</strong>
                <small>
                  {stance.disadvantage ? "2d20 · помеха" : "d20 · атака"}
                </small>
              </span>
              <Dices size={19} />
            </button>
          </div>
          <strong role="cell">
            {signed(weapon?.bonus ?? game.strength)}
            <span className="cell-note">
              {weapon?.bonus == null ? "СИЛ" : "Вручную"}
            </span>
          </strong>
          <span role="cell" className="damage-formula">
            {weapon?.damage || `1d${stance.damageDie} ${signed(game.strength)}`}
          </span>
          <span role="cell" title="Тип урона не задан">
            {weapon?.damageType || "Не задан"}
          </span>
        </div>
        {stance.id === "shield" && (
          <div className="attack-row unavailable" role="row">
            <div role="cell">
              <button
                className="attack-button"
                disabled
                aria-label="Меч недоступен в стойке щита"
              >
                <Sword size={23} />
                <span>
                  <strong>Меч</strong>
                  <small>Недоступен в этой стойке</small>
                </span>
              </button>
            </div>
            <span role="cell">—</span>
            <span role="cell">1d8 {signed(game.strength)}</span>
            <span role="cell">—</span>
          </div>
        )}
      </div>
      {!available && !state.attack && (
        <p className="inline-note">
          {state.counter
            ? "Сначала выполните немедленную ответную атаку."
            : state.reaction
              ? "Сначала разрешите реакцию."
              : state.spent.main
                ? "Основное действие уже потрачено в этом раунде."
                : "Дождитесь результата броска."}
        </p>
      )}
      {state.attack && (
        <AttackResolution
          key={state.attack.roll.id}
          pending={state.attack}
          game={game}
        />
      )}
      {state.counter && (
        <div className="trigger-callout">
          <span className="eyebrow">После парирования</span>
          <strong>
            {state.counter.critical
              ? "Критическая ответная атака"
              : "Ответная атака доступна"}
          </strong>
          <p>
            Выполните её сейчас. Основное и бонусное действия не расходуются.
          </p>
          <button
            className="button primary"
            disabled={game.rolling}
            onClick={() => game.attack("counter")}
          >
            <Sword size={17} />
            Ответная атака
          </button>
        </div>
      )}
      {state.finisher &&
        !state.spent.bonus &&
        !state.attack &&
        !state.counter && (
          <div className="trigger-callout">
            <span className="eyebrow">Цель повержена</span>
            <strong>Добивание доступно</strong>
            <p>
              Ещё одна атака другой цели за бонусное действие. Цепочка не
              продолжается.
            </p>
            <button
              className="button primary"
              disabled={game.rolling}
              onClick={() => game.attack("finisher")}
            >
              <Swords size={17} />
              Добивание · бонусное действие
            </button>
          </div>
        )}
      <details className="rules-note">
        <summary>Как считается атака</summary>
        <p>
          d20 +{" "}
          {weapon?.bonus == null
            ? `текущий модификатор СИЛ (${signed(game.strength)})`
            : `введённый бонус (${signed(weapon.bonus)})`}
          . Дополнительный бонус атаки и владение не заданы, поэтому не
          добавляются. Тип урона и общие правила критического попадания пока не
          определены. Попадание подтверждает игрок по решению мастера.
        </p>
      </details>
    </section>
  );
}
function AttackResolution({
  pending,
  game,
}: {
  pending: PendingAttack;
  game: SheetController;
}) {
  const [killed, setKilled] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [manual, setManual] = useState("");
  const manualValue = Number(manual);
  const validManual =
    manual !== "" &&
    Number.isInteger(manualValue) &&
    manualValue >= 0 &&
    manualValue <= 100000;
  const damageFormula =
    game.state.core.tilzit?.weapons[
      pending.stance === "shield" ? "shield" : "sword"
    ].damage ||
    `1d${stances[pending.stance].damageDie} ${signed(game.strength)}`;
  return (
    <div className="attack-resolution" aria-label="Разрешение атаки">
      <div className="resolution-title">
        <span className="step-number">{pending.hit ? "02" : "01"}</span>
        <div>
          <span className="eyebrow">
            {pending.hit ? "Урон" : "Бросок атаки"}
          </span>
          <strong>{pending.roll.label}</strong>
        </div>
        <span className="resolution-total">{pending.roll.total}</span>
      </div>
      <p className="attack-breakdown">
        {rollSummary(pending.roll)}
        {pending.roll.values.length === 2 && <span> · выбрано меньшее</span>}
      </p>
      {!pending.hit ? (
        <>
          <p className="inline-note">Результат попадания подтверждает игрок.</p>
          <div className="button-row">
            <button
              className="button primary"
              disabled={game.rolling}
              onClick={() => game.send({ type: "hit" })}
            >
              <Check size={16} />
              Попадание
            </button>
            <button
              className="button secondary"
              disabled={game.rolling}
              onClick={() => game.send({ type: "miss" })}
            >
              <X size={16} />
              Промах
            </button>
          </div>
        </>
      ) : (
        <>
          {!pending.damage &&
            (pending.critical ? (
              <div className="critical-manual">
                <p>
                  Ответная атака критическая. Формула критического урона не
                  задана — согласуйте урон с мастером.
                </p>
                <label htmlFor="critical-damage">
                  Критический урон вручную
                </label>
                <div className="button-row">
                  <input
                    id="critical-damage"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                  />
                  <button
                    className="button primary"
                    disabled={!validManual || game.rolling}
                    onClick={() => game.criticalDamage(manualValue)}
                  >
                    Записать урон
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button primary damage-roll"
                disabled={game.rolling || !parseDamage(damageFormula)}
                onClick={game.damage}
              >
                <Dices size={19} />
                Бросить урон
                <span>{damageFormula}</span>
              </button>
            ))}
          {pending.damage && (
            <>
              <p className="damage-confirmed">
                <Check size={16} />
                Урон: <strong>{pending.damage.total}</strong>
                <span>{rollSummary(pending.damage)}</span>
              </p>
              {pending.stance === "assault" && pending.origin === "main" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={killed}
                    onChange={(e) => setKilled(e.target.checked)}
                  />
                  Эта основная атака убила противника
                </label>
              )}
              {pending.stance === "shield" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={pushed}
                    onChange={(e) => setPushed(e.target.checked)}
                  />
                  Толчок успешен · подтверждено мастером
                </label>
              )}
              <button
                className="button secondary"
                disabled={game.rolling}
                onClick={() =>
                  game.send({ type: "finish-attack", killed, pushed })
                }
              >
                Завершить атаку
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
