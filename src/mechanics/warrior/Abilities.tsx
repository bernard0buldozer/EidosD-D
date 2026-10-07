import { useState } from "react";
import { BookOpen, Dices, Shield, Sword, Swords } from "../../components/Icons";
import { SectionTitle } from "../../components/SectionTitle";
import type { SheetController } from "../../state/useSheet";
import { stances } from "./config";
import { canReact } from "./rules";
import { rollSummary } from "../../domain/dice";
export function Abilities({ game }: { game: SheetController }) {
  const state = game.state.mechanic;
  const stance = stances[state.stance];
  const [natural, setNatural] = useState("");
  const validNatural =
    natural !== "" &&
    Number.isInteger(Number(natural)) &&
    Number(natural) >= 1 &&
    Number(natural) <= 20;
  const pending = state.reaction;
  const resolve = (success: boolean) => {
    game.send({
      type: "resolve-reaction",
      success,
      natural: natural === "" ? null : Number(natural),
    });
    setNatural("");
  };
  const Icon =
    state.stance === "shield"
      ? Shield
      : state.stance === "duelist"
        ? Sword
        : Swords;
  return (
    <section className="abilities panel" id="abilities">
      <SectionTitle
        title="Способности"
        icon={<BookOpen size={19} />}
        trailing={<span className="hint">Активная стойка</span>}
      />
      <div className="ability-title">
        <Icon size={27} />
        <div>
          <h3>{stance.reactionName ?? "Добивание"}</h3>
          <span className="eyebrow">
            {stance.reactionName ? "Реакция" : "Бонусное действие"}
          </span>
        </div>
        {stance.reactionName && (
          <span className={`tag ${state.spent.reaction ? "used" : ""}`}>
            {state.spent.reaction ? "Потрачена" : "Доступна"}
          </span>
        )}
      </div>
      <p className="ability-description">{stance.description}</p>
      {state.stance === "duelist" && (
        <p className="restriction">
          Только рукопашная атака. Не работает против стрел, магии и атак по
          площади.
        </p>
      )}
      {stance.reactionName && !pending && (
        <button
          className="button secondary"
          disabled={!canReact(state) || game.rolling}
          onClick={() => game.send({ type: "reaction" })}
        >
          {state.stance === "duelist" ? (
            <Sword size={17} />
          ) : (
            <Shield size={17} />
          )}
          Использовать{" "}
          {state.stance === "duelist" ? "парирование" : "прикрытие"}
        </button>
      )}
      {pending && (
        <div className="reaction-resolution">
          <span className="eyebrow">Реакция уже потрачена</span>
          {pending.kind === "parry" ? (
            <>
              <p>
                Формула и сложность парирования не заданы. Бросьте только d20
                или введите результат физического кубика; успех определяет
                мастер.
              </p>
              {!pending.roll ? (
                <>
                  <button
                    className="button secondary"
                    disabled={game.rolling}
                    onClick={game.parry}
                  >
                    <Dices size={17} />
                    Бросить d20 парирования
                  </button>
                  <label className="number-label" htmlFor="parry-natural">
                    Натуральный d20 вручную
                    <input
                      id="parry-natural"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={natural}
                      onChange={(e) => setNatural(e.target.value)}
                      placeholder="1–20"
                    />
                  </label>
                </>
              ) : (
                <p className="parry-result">
                  {rollSummary(pending.roll)}
                  {pending.roll.values[0] === 20 && (
                    <strong> · при успехе ответ критический</strong>
                  )}
                </p>
              )}
            </>
          ) : (
            <p>
              Подтвердите: удалось ли принять атаку на себя и прикрыть соседнего
              союзника?
            </p>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={
                (pending.kind === "parry" && !pending.roll && !validNatural) ||
                game.rolling
              }
              onClick={() => resolve(true)}
            >
              {pending.kind === "parry"
                ? "Парирование успешно"
                : "Прикрытие успешно"}
            </button>
            <button
              className="button secondary"
              disabled={game.rolling}
              onClick={() => resolve(false)}
            >
              Не удалось
            </button>
          </div>
        </div>
      )}
      {state.stance === "shield" && (
        <details className="ability-details">
          <summary>Толчок щитом</summary>
          <p>
            При попадании атакой щитом можно оттолкнуть цель. Успешный толчок
            открывает бесплатную смену стойки. Сложность и формула толчка не
            заданы; подтвердите успех при завершении атаки.
          </p>
        </details>
      )}
      <details className="ability-details">
        <summary>Смена стойки после атаки</summary>
        <p>
          После успешной собственной атаки можно потратить бонусное действие на
          смену стойки. Бесплатный триггер используется один раз и не расходует
          бонусное действие. Незавершённую атаку или реакцию сначала нужно
          разрешить.
        </p>
      </details>
    </section>
  );
}
