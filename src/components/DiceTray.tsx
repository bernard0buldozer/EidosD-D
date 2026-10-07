import { useState } from "react";
import type { DicePool, DieSides, Roll } from "../domain/types";
import { rollSummary } from "../domain/dice";
const sides: DieSides[] = [4, 6, 8, 10, 12, 20];
export function DiceTray({
  rolling,
  onRoll,
  onHistory,
  lastRoll,
}: {
  rolling: boolean;
  onRoll: (pool: DicePool[], modifier: number) => void;
  onHistory: () => void;
  lastRoll: Roll | null;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({ 20: 1 });
  const [modifier, setModifier] = useState(0);
  const pool = sides
    .filter((d) => counts[d] > 0)
    .map((d) => ({ sides: d, quantity: counts[d] }));
  const total = pool.reduce((n, p) => n + p.quantity, 0);
  return (
    <aside
      className={`dice-tray ${open ? "open" : ""}`}
      aria-label="Лоток кубиков"
    >
      <button
        className="dice-tray-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ◇ Кубики <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="dice-tray-content">
          <div className="dice-picker">
            {sides.map((d) => (
              <label key={d}>
                <span>d{d}</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  aria-label={`Количество d${d}`}
                  value={counts[d] ?? 0}
                  onChange={(e) =>
                    setCounts({
                      ...counts,
                      [d]: Math.min(
                        30,
                        Math.max(0, Math.trunc(Number(e.target.value))),
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="dice-modifier">
            Модификатор
            <input
              aria-label="Модификатор свободного броска"
              type="number"
              value={modifier}
              onChange={(e) => setModifier(Math.trunc(Number(e.target.value)))}
            />
          </label>
          <p>
            {pool.map((p) => `${p.quantity}d${p.sides}`).join(" + ") ||
              "Выберите кубики"}
            {modifier !== 0 &&
              ` ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)}`}
          </p>
          {total > 30 && (
            <p role="alert">В одном броске доступно до 30 кубиков.</p>
          )}
          <button
            className="button primary"
            disabled={!total || total > 30 || rolling}
            onClick={() => {
              setOpen(false);
              onRoll(pool, modifier);
            }}
          >
            {rolling ? "Бросаем…" : "Бросить"}
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setCounts({});
              setModifier(0);
            }}
          >
            Очистить выбор
          </button>
        </div>
      )}
      {!open && lastRoll && (
        <p className="tray-last">
          {lastRoll.label}: <strong>{lastRoll.total ?? "решает мастер"}</strong>
        </p>
      )}
      <button className="tray-history" onClick={onHistory}>
        История бросков
      </button>
    </aside>
  );
}
export function RollHistory({
  history,
  onClear,
}: {
  history: Roll[];
  onClear: () => void;
}) {
  return (
    <>
      <button
        className="button secondary"
        disabled={!history.length}
        onClick={onClear}
      >
        Очистить историю бросков
      </button>
      {!history.length ? (
        <p>Здесь появятся последние 10 бросков.</p>
      ) : (
        <ol className="history-list">
          {history.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.label}</strong>
                <time>{new Date(r.timestamp).toLocaleString("ru-RU")}</time>
              </div>
              <p>
                {r.pool?.map((p) => `${p.quantity}d${p.sides}`).join(" + ") ||
                  (r.sides ? `${r.values.length}d${r.sides}` : "Вручную")}{" "}
                · {rollSummary(r)}
              </p>
              <small>
                {r.dice?.map((d) => `d${d.sides}: ${d.value}`).join(" · ")}
                {r.disadvantage ? " · помеха: выбрано меньшее" : ""}
              </small>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
