import {
  Shield,
  Sword,
  Swords,
  Check,
  ArrowRight,
} from "../../components/Icons";
import { SectionTitle } from "../../components/SectionTitle";
import { stanceOrder, stances } from "./config";
import { shiftPermission, type WarriorState, type WarriorEvent } from "./rules";
export const stanceIcons = { shield: Shield, duelist: Sword, assault: Swords };
export function Stances({
  state,
  send,
}: {
  state: WarriorState;
  send: (event: WarriorEvent) => void;
}) {
  const permission = shiftPermission(state);
  return (
    <section className="stances panel" id="stances">
      <SectionTitle
        title="Боевые стойки"
        icon={<Swords size={19} />}
        trailing={
          <span className={`tag ${permission.mode === "free" ? "free" : ""}`}>
            {permission.mode === "free"
              ? "Бесплатная смена"
              : state.phase === "preparation"
                ? "Подготовка"
                : "В бою"}
          </span>
        }
      />
      <div className="stance-grid">
        {stanceOrder.map((id) => {
          const stance = stances[id];
          const Icon = stanceIcons[id];
          const active = id === state.stance;
          return (
            <button
              key={id}
              className={`stance-card ${active ? "active" : ""} ${id}`}
              aria-label={`Выбрать стойку: ${stance.name}`}
              aria-pressed={active}
              disabled={!active && permission.mode === "blocked"}
              onClick={() => send({ type: "shift", stance: id })}
            >
              <div className="stance-top">
                <Icon size={27} strokeWidth={1.5} />
                <span className="stance-defense">
                  <Shield size={12} />
                  {stance.defense}
                </span>
              </div>
              <strong>{stance.name}</strong>
              <span className="stance-equipment">{stance.equipment}</span>
              <span className="stance-footer">
                {active ? (
                  <>
                    <Check size={13} />
                    Активна
                  </>
                ) : (
                  <>
                    Выбрать
                    <ArrowRight size={13} />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className={`stance-permission ${permission.mode === "free" ? "free-text" : ""}`}
        role="status"
      >
        {permission.reason}
      </p>
    </section>
  );
}
