import { useState } from "react";
import { Check, Circle, RotateCcw } from "../../components/Icons";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { ActionSlot, WarriorState, WarriorEvent } from "./rules";
const labels: Record<ActionSlot, string> = {
  main: "Основное действие",
  bonus: "Бонусное действие",
  reaction: "Реакция",
};
export function ActionEconomy({
  state,
  send,
}: {
  state: WarriorState;
  send: (event: WarriorEvent) => void;
}) {
  const [confirm, setConfirm] = useState<"round" | "preparation" | null>(null);
  const newRound = () => {
    if (state.attack || state.reaction || state.counter) setConfirm("round");
    else send({ type: "new-round" });
  };
  return (
    <>
      <section className="economy" aria-label="Экономика раунда">
        <div className="round-number">
          <span className="eyebrow">
            {state.phase === "combat" ? "Раунд" : "До боя"}
          </span>
          <strong>
            {state.phase === "combat"
              ? String(state.round).padStart(2, "0")
              : "—"}
          </strong>
        </div>
        <div className="action-slots">
          {(["main", "bonus", "reaction"] as const).map((slot) => (
            <div
              key={slot}
              className={`action-slot ${state.spent[slot] ? "spent" : ""}`}
              data-testid={`action-${slot}`}
            >
              <span>
                {state.spent[slot] ? <Check size={16} /> : <Circle size={16} />}
                <strong>{labels[slot]}</strong>
              </span>
              <small>{state.spent[slot] ? "Потрачено" : "Доступно"}</small>
            </div>
          ))}
        </div>
        <div className="round-controls">
          {state.phase === "preparation" ? (
            <button
              className="button primary compact"
              onClick={() => send({ type: "start-combat" })}
            >
              Начать бой
            </button>
          ) : (
            <button className="button secondary compact" onClick={newRound}>
              <RotateCcw size={15} />
              Новый раунд
            </button>
          )}
          {state.phase === "combat" && (
            <button
              className="text-button"
              onClick={() => setConfirm("preparation")}
            >
              Выйти из боя
            </button>
          )}
        </div>
      </section>
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "round"
              ? "Начать новый раунд?"
              : "Перейти к подготовке?"
          }
          confirmLabel={confirm === "round" ? "Новый раунд" : "Завершить бой"}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            send({ type: confirm === "round" ? "new-round" : "preparation" })
          }
        >
          <p>
            {confirm === "round"
              ? "Незавершённая атака, реакция или ответная атака будут отменены. Все действия восстановятся."
              : "Расход действий и боевые триггеры будут сброшены. Вы снова сможете вручную выбирать стойку."}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
