import { useState } from "react";
import { smarchok } from "../../data/smarchok";
import { useCharacter, type CoreController } from "../../state/core";
import { useDice } from "../../dice/DiceProvider";
import type { Attribute, DicePool } from "../../domain/types";
import { MushroomMark } from "../../components/MushroomMark";
import { NumberField, Overlay } from "../../components/Overlay";
import {
  smarchokAction,
  smarchokPlugin,
  normalizeMycelium,
  type SmarchokState,
  type SmarchokAction,
  type Body,
} from "./rules";
export function useSmarchok() {
  const core = useCharacter(smarchok, smarchokPlugin);
  const dice = useDice();
  const rollAttribute = async (a: Attribute) => {
    const r = await dice.roll({
      label: a.checkLabel,
      kind: "attribute",
      pool: [{ sides: 20, quantity: 1 }],
      modifier: a.modifier,
    });
    if (r) core.recordRoll(r);
  };
  const freeRoll = async (pool: DicePool[], modifier: number) => {
    const r = await dice.roll({
      label: "Свободный бросок",
      kind: "free",
      pool,
      modifier,
    });
    if (r) core.recordRoll(r);
  };
  return { ...core, rolling: dice.rolling, rollAttribute, freeRoll };
}
type Game = CoreController<SmarchokState>;
export function Mycelium({ game }: { game: Game }) {
  const s = game.state.mechanic;
  return (
    <div className="vital mycelium">
      <span className="eyebrow">
        <MushroomMark size={18} /> Мицелий
      </span>
      <div className="resource-inputs">
        <NumberField
          label="Текущий Мицелий"
          value={s.current}
          onChange={(current) =>
            game.setMechanic(normalizeMycelium({ ...s, current }))
          }
        />
        <span>/</span>
        <NumberField
          label="Максимальный Мицелий"
          value={s.maximum}
          onChange={(maximum) =>
            game.setMechanic(normalizeMycelium({ ...s, maximum }))
          }
        />
      </div>
      <span className="vital-note">текущее / максимум</span>
    </div>
  );
}
const abilities = [
  {
    id: "raise",
    name: "Поднять мертвеца",
    cost: 5,
    text: "Заражает целое мёртвое тело спорами и поднимает под ваш контроль. Количество поднятых тел не ограничено.",
  },
  {
    id: "heal",
    name: "Регенерация Туши",
    cost: null,
    text: "1 Мицелий восстанавливает ровно 1 HP Туши. Без кубиков. Списывается только фактически восстановленное здоровье.",
  },
  {
    id: "field",
    name: "Мицелиальное поле",
    cost: null,
    text: "Создаёт заражённую территорию. Чем больше вложено Мицелия, тем больше область. Размер и точный дебафф определяет мастер; числовые правила не заданы.",
  },
  {
    id: "link",
    name: "Споровая связь",
    cost: 1,
    text: "Общение с разумным существом через споры независимо от обычного языка.",
  },
  {
    id: "read",
    name: "Считывание",
    cost: 2,
    text: "Только текущая мысль существа. Не чтение воспоминаний и не доступ к полному разуму.",
  },
  {
    id: "fear",
    name: "Запугивание спорами",
    cost: 3,
    text: "Страх и дезориентация через воздействие на мозг и нервную систему. Точные числовые штрафы не заданы.",
  },
];
export function SmarchokAbilities({ game }: { game: Game }) {
  const [selected, setSelected] = useState<string | null>(null);
  const s = game.state.mechanic;
  return (
    <section className="fungal-abilities panel" id="abilities">
      <h2 className="folio-heading">
        <MushroomMark /> Способности / особенности
      </h2>
      <span className="hint">Используют Мицелий</span>
      <ul>
        {abilities.map((a) => (
          <li key={a.id}>
            <button onClick={() => setSelected(a.id)}>
              <strong>{a.name}</strong>
              <span>
                {a.cost ?? "X"} мицелия <b>›</b>
              </span>
            </button>
            {a.cost !== null && (s.current === null || s.current < a.cost) && (
              <small>
                {s.current === null
                  ? "Укажите запас Мицелия"
                  : "Недостаточно Мицелия"}
              </small>
            )}
          </li>
        ))}
      </ul>
      {selected && (
        <AbilityAction
          key={selected}
          id={selected}
          game={game}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function AbilityAction({
  id,
  game,
  onClose,
}: {
  id: string;
  game: Game;
  onClose: () => void;
}) {
  const a = abilities.find((a) => a.id === id)!;
  const s = game.state.mechanic;
  const core = game.state.core;
  const [amount, setAmount] = useState<number | null>(1);
  const [bodyId, setBodyId] = useState("");
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");
  const effective =
    id === "heal" && core.hp !== null && core.maxHp !== null
      ? Math.min(amount ?? 0, core.maxHp - core.hp)
      : (a.cost ?? amount ?? 0);
  const problem =
    s.current === null
      ? "Укажите текущий Мицелий в листе."
      : id === "heal" && (core.hp === null || core.maxHp === null)
        ? "Укажите здоровье и максимум Туши в редактировании листа."
        : effective <= 0
          ? id === "heal"
            ? "Туша полностью здорова или количество не задано."
            : "Укажите положительное количество."
          : s.current < effective
            ? `Недостаточно Мицелия: требуется ${effective}, доступно ${s.current}.`
            : id === "raise" && !bodyId && !name.trim()
              ? "Выберите сохранённое тело или укажите имя / описание нового."
              : "";
  const use = () => {
    const action: SmarchokAction =
      id === "raise"
        ? { type: "raise", bodyId: bodyId || undefined, name }
        : id === "heal"
          ? { type: "heal", amount: amount ?? 0 }
          : { type: "ability", label: a.name, cost: a.cost ?? amount ?? 0 };
    const result = smarchokAction(s, core, action);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    game.setMechanic(
      result.state,
      result.hp !== undefined ? { hp: result.hp } : undefined,
    );
    setFeedback(
      `${a.name}: использовано ${s.current! - result.state.current!} Мицелия${result.hp !== undefined ? `, здоровье Туши ${result.hp} / ${core.maxHp}` : ""}.`,
    );
    if (id === "raise") {
      setName("");
      setBodyId("");
    }
  };
  return (
    <Overlay title={a.name} onClose={onClose}>
      <p className="ability-description">{a.text}</p>
      <p className="resource-balance">
        Мицелий:{" "}
        <strong>
          {s.current ?? "—"} / {s.maximum ?? "—"}
        </strong>
      </p>
      {id === "raise" && (
        <div className="entry-editor">
          <label>
            Сохранённое тело
            <select
              aria-label="Сохранённое тело"
              value={bodyId}
              onChange={(e) => setBodyId(e.target.value)}
            >
              <option value="">Новое тело</option>
              {s.bodies
                .filter((b) => b.status === "saved")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || "Без названия"}
                  </option>
                ))}
            </select>
          </label>
          {!bodyId && (
            <label>
              Имя / описание поднимаемого тела
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <p className="inline-note">
            Переработанные тела недоступны. Поднятые существа появятся в трекере
            «Тела и нежить».
          </p>
        </div>
      )}
      {a.cost === null && (
        <NumberField
          label={id === "heal" ? "Восстановить HP" : "Вложить Мицелий"}
          value={amount}
          min={1}
          onChange={setAmount}
        />
      )}
      {id === "heal" && (
        <p>
          Туша: {core.hp ?? "—"} / {core.maxHp ?? "—"} HP. Будет восстановлено:{" "}
          {Math.max(0, effective)} HP.
        </p>
      )}
      <button className="button primary" disabled={!!problem} onClick={use}>
        Использовать · {Math.max(0, effective)} Мицелия
      </button>
      {problem && (
        <p className="inline-note" role="status">
          {problem}
        </p>
      )}
      {feedback && (
        <p className="action-feedback" role="status">
          {feedback}
        </p>
      )}
    </Overlay>
  );
}
export function Bodies({ game }: { game: Game }) {
  const s = game.state.mechanic;
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(1);
  const [feedback, setFeedback] = useState("");
  const body = s.bodies.find((b) => b.id === selected);
  const patch = (p: Partial<Body>) =>
    game.setMechanic({
      ...s,
      bodies: s.bodies.map((b) => (b.id === selected ? { ...b, ...p } : b)),
    });
  const action = (a: SmarchokAction) => {
    const result = smarchokAction(s, game.state.core, a);
    if (result.error) setFeedback(result.error);
    else {
      game.setMechanic(result.state);
      setFeedback(
        a.type === "process"
          ? "Тело полностью переработано. Поднять его больше нельзя."
          : a.type === "raise"
            ? "Тело поднято. Списано 5 Мицелия."
            : "Мицелий добавлен.",
      );
    }
  };
  const labels = {
    saved: "Сохранено целым",
    processed: "Переработано",
    raised: "Поднятая нежить",
  };
  return (
    <>
      <p>
        Сохраните целое тело для поднятия или переработайте его. Боевая
        статистика нежити определяется вручную.
      </p>
      <div className="collection-toolbar">
        <button
          className="button primary"
          onClick={() => {
            const id = crypto.randomUUID();
            game.setMechanic({
              ...s,
              bodies: [
                ...s.bodies,
                {
                  id,
                  name: "",
                  description: "",
                  hp: null,
                  maxHp: null,
                  notes: "",
                  status: "saved",
                  condition: "",
                  gained: null,
                },
              ],
            });
            setSelected(id);
            setFeedback("");
          }}
        >
          Добавить тело
        </button>
        <NumberField
          label="Получено Мицелия вручную"
          value={amount}
          min={1}
          onChange={setAmount}
        />
        <button
          className="button secondary"
          onClick={() => action({ type: "gain", amount: amount ?? 0 })}
        >
          Добавить Мицелий
        </button>
      </div>
      <p className="inline-note">
        Ориентиры: мелкое тело ≈ 1; гуманоид 2–3; крупное или магическое 4–5+.
        Это не окончательная таблица. Количество указывает игрок.
      </p>
      <div className="collection-layout">
        <div className="collection-list">
          {s.bodies.map((b) => (
            <button
              key={b.id}
              className={selected === b.id ? "selected" : ""}
              onClick={() => {
                setSelected(b.id);
                setFeedback("");
              }}
            >
              <strong>{b.name || "Без названия"}</strong>
              <span>{labels[b.status]}</span>
              {b.gained !== null && <small>Получено {b.gained} Мицелия</small>}
            </button>
          ))}
          {!s.bodies.length && <p>Сохранённых тел и нежити пока нет.</p>}
        </div>
        {body && (
          <div className="entry-editor">
            <label>
              Имя тела
              <input
                value={body.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <strong>{labels[body.status]}</strong>
            <label>
              Описание тела
              <textarea
                value={body.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <div className="edit-vitals">
              <NumberField
                label="HP тела"
                value={body.hp}
                onChange={(hp) => patch({ hp })}
              />
              <NumberField
                label="Максимум HP тела"
                value={body.maxHp}
                onChange={(maxHp) => patch({ maxHp })}
              />
            </div>
            <label>
              Состояние тела
              <input
                value={body.condition}
                onChange={(e) => patch({ condition: e.target.value })}
              />
            </label>
            <label>
              Заметки о теле
              <textarea
                value={body.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </label>
            {body.status === "saved" ? (
              <>
                <button
                  className="button primary"
                  disabled={s.current === null || s.current < 5}
                  onClick={() => action({ type: "raise", bodyId: body.id })}
                >
                  Поднять это тело · 5 Мицелия
                </button>
                {(s.current === null || s.current < 5) && (
                  <p>Недостаточно Мицелия для поднятия.</p>
                )}
                <button
                  className="button secondary"
                  disabled={
                    !amount ||
                    s.current === null ||
                    (s.maximum !== null && s.current + amount > s.maximum)
                  }
                  onClick={() =>
                    action({
                      type: "process",
                      bodyId: body.id,
                      amount: amount ?? 0,
                    })
                  }
                >
                  Переработать целиком · +{amount ?? 0} Мицелия
                </button>
                {s.maximum !== null &&
                  s.current !== null &&
                  amount !== null &&
                  s.current + amount > s.maximum && (
                    <p>Полученное количество превышает максимум Мицелия.</p>
                  )}
              </>
            ) : (
              <p className="restriction">
                {body.status === "processed"
                  ? "Тело переработано. Поднятие и повторная переработка недоступны."
                  : "Поднятое тело уже используется. Повторное поднятие и переработка недоступны."}
              </p>
            )}
            <button
              className="button secondary"
              onClick={() => {
                game.setMechanic({
                  ...s,
                  bodies: s.bodies.filter((b) => b.id !== body.id),
                });
                setSelected(null);
              }}
            >
              Удалить запись тела
            </button>
          </div>
        )}
      </div>
      {feedback && (
        <p className="action-feedback" role="status">
          {feedback}
        </p>
      )}
      <details className="mycelium-log">
        <summary>Учёт Мицелия · {s.log.length} записей</summary>
        <ol>
          {s.log.map((l) => (
            <li key={l.id}>
              <time>{new Date(l.timestamp).toLocaleString("ru-RU")}</time>{" "}
              {l.label} · {l.cost > 0 ? "−" : "+"}
              {Math.abs(l.cost)}
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
