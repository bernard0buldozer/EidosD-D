import type { Roll } from "../domain/types";
import { rollSummary, signed } from "../domain/dice";
import { Dices, ScrollText, Trash2 } from "./Icons";
import { DiceVisualizer } from "./DiceVisualizer";
import { SectionTitle } from "./SectionTitle";
export function RollPanel({
  roll,
  history,
  rolling,
  clearHistory,
}: {
  roll: Roll | null;
  history: Roll[];
  rolling: boolean;
  clearHistory: () => void;
}) {
  return (
    <aside className="roll-column" id="dice" aria-label="Броски и история">
      <section className="roll-panel" aria-label="Результат последнего броска">
        <div className="roll-heading">
          <Dices size={18} />
          <h2>Последний бросок</h2>
          <span className="tiny-diamond">◆</span>
        </div>
        {roll ? (
          <>
            <p className="roll-name">{roll.label}</p>
            <div className="dice-stage">
              {roll.sides &&
                roll.values.map((value, i) => (
                  <div key={`${roll.id}-${i}`} className="die-and-caption">
                    <DiceVisualizer
                      sides={roll.sides!}
                      value={value}
                      rolling={rolling}
                      selected={i === roll.selectedIndex}
                    />
                    <span>
                      d{roll.sides}
                      {roll.values.length === 2 && (
                        <small>
                          {i === roll.selectedIndex ? "Выбран" : "Не выбран"}
                        </small>
                      )}
                    </span>
                  </div>
                ))}
              {roll.kind === "manual" && (
                <span className="manual-damage-value">{roll.total}</span>
              )}
            </div>
            {roll.values.length === 2 && (
              <p className="disadvantage-note">Помеха · используется меньшее</p>
            )}
            {roll.values.length === 1 &&
              roll.sides === 20 &&
              [1, 20].includes(roll.values[0]) && (
                <p className="natural-note">Натуральная {roll.values[0]}</p>
              )}
            <div className="roll-math">
              <div>
                <span>
                  {roll.kind === "parry"
                    ? "Модификатор не задан"
                    : "Модификатор"}
                </span>
                <strong>
                  {roll.modifier === null ? "—" : signed(roll.modifier)}
                </strong>
              </div>
              <div className="roll-total">
                <span>{roll.total === null ? "Решает мастер" : "Итого"}</span>
                <strong data-testid="roll-total">
                  {rolling ? "…" : (roll.total ?? "—")}
                </strong>
              </div>
            </div>
            {roll.critical && (
              <p className="critical-label">Критическая ответная атака</p>
            )}
            <p
              className="visually-hidden"
              aria-live="polite"
              aria-atomic="true"
            >
              {!rolling && `${roll.label}: ${rollSummary(roll)}`}
            </p>
          </>
        ) : (
          <div className="roll-empty">
            <Dices size={68} strokeWidth={0.8} />
            <p>Кубики готовы</p>
            <span>
              Нажмите характеристику
              <br />
              или доступную атаку
            </span>
          </div>
        )}
      </section>
      <section className="roll-history panel" aria-label="История бросков">
        <SectionTitle
          title="История бросков"
          icon={<ScrollText size={17} />}
          trailing={
            history.length > 0 && (
              <button
                className="icon-button"
                aria-label="Очистить историю бросков"
                onClick={clearHistory}
              >
                <Trash2 size={15} />
              </button>
            )
          }
        />
        {history.length === 0 ? (
          <p className="history-empty">Здесь появятся последние 10 бросков.</p>
        ) : (
          <ol>
            {history.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.label}</strong>
                  <time dateTime={new Date(r.timestamp).toISOString()}>
                    {new Date(r.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <span>{rollSummary(r)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
