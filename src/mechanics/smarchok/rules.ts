import type { CharacterSession } from "../../domain/types";
export interface Body {
  id: string;
  name: string;
  description: string;
  hp: number | null;
  maxHp: number | null;
  notes: string;
  status: "saved" | "processed" | "raised";
  condition: string;
  gained: number | null;
}
export interface SmarchokState {
  current: number | null;
  maximum: number | null;
  bodies: Body[];
  log: { id: string; label: string; cost: number; timestamp: number }[];
}
export const initialSmarchok = (): SmarchokState => ({
  current: null,
  maximum: null,
  bodies: [],
  log: [],
});
export const normalizeMycelium = (s: SmarchokState): SmarchokState => ({
  ...s,
  maximum: s.maximum === null ? null : Math.max(0, Math.trunc(s.maximum)),
  current:
    s.current === null
      ? null
      : Math.max(0, Math.min(s.maximum ?? Infinity, Math.trunc(s.current))),
});
export function decodeSmarchok(v: unknown): SmarchokState {
  if (!v || typeof v !== "object") return initialSmarchok();
  const s = v as SmarchokState;
  return normalizeMycelium({
    current:
      typeof s.current === "number" && Number.isFinite(s.current)
        ? s.current
        : null,
    maximum:
      typeof s.maximum === "number" && Number.isFinite(s.maximum)
        ? s.maximum
        : null,
    bodies: Array.isArray(s.bodies)
      ? s.bodies.filter(
          (b) =>
            b &&
            ["id", "name", "description", "notes", "condition"].every(
              (k) => typeof b[k as keyof Body] === "string",
            ) &&
            ["saved", "processed", "raised"].includes(b.status) &&
            (b.hp === null || Number.isFinite(b.hp)) &&
            (b.maxHp === null || Number.isFinite(b.maxHp)) &&
            (b.gained === null || Number.isFinite(b.gained)),
        )
      : [],
    log: Array.isArray(s.log)
      ? s.log.filter(
          (l) =>
            l &&
            typeof l.id === "string" &&
            typeof l.label === "string" &&
            Number.isFinite(l.cost) &&
            Number.isFinite(l.timestamp),
        )
      : [],
  });
}
export type SmarchokAction =
  | { type: "ability"; label: string; cost: number }
  | { type: "heal"; amount: number }
  | { type: "process"; bodyId: string; amount: number }
  | { type: "gain"; amount: number }
  | { type: "raise"; bodyId?: string; name?: string };
export function smarchokAction(
  state: SmarchokState,
  core: CharacterSession,
  action: SmarchokAction,
): { state: SmarchokState; hp?: number; error?: string } {
  const fail = (error: string) => ({ state, error });
  const amount =
    action.type === "raise"
      ? 5
      : action.type === "ability"
        ? action.cost
        : action.amount;
  if (!Number.isInteger(amount) || amount < 1)
    return fail("Укажите целое положительное количество.");
  if (state.current === null)
    return fail("Сначала укажите текущее количество Мицелия.");
  if (action.type === "gain" || action.type === "process") {
    const body =
      action.type === "process"
        ? state.bodies.find((b) => b.id === action.bodyId)
        : null;
    if (action.type === "process" && (!body || body.status !== "saved"))
      return fail("Это тело уже переработано или поднято.");
    if (state.maximum !== null && state.current + amount > state.maximum)
      return fail(
        "Полученное количество превышает максимум Мицелия. Скорректируйте максимум или количество.",
      );
    return {
      state: {
        ...state,
        current: state.current + amount,
        bodies: state.bodies.map((b) =>
          b === body ? { ...b, status: "processed", gained: amount } : b,
        ),
        log: [
          {
            id: crypto.randomUUID(),
            label: body
              ? `Переработано: ${body.name}`
              : "Мицелий добавлен вручную",
            cost: -amount,
            timestamp: Date.now(),
          },
          ...state.log,
        ],
      },
    };
  }
  let actual = amount;
  if (action.type === "heal") {
    if (core.hp === null || core.maxHp === null)
      return fail("Сначала укажите текущее и максимальное здоровье Туши.");
    actual = Math.min(amount, core.maxHp - core.hp);
    if (actual <= 0) return fail("Туша уже полностью здорова.");
  }
  if (state.current < actual)
    return fail(
      `Недостаточно Мицелия: требуется ${actual}, доступно ${state.current}.`,
    );
  let bodies = state.bodies;
  if (action.type === "raise") {
    if (action.bodyId) {
      const body = bodies.find((b) => b.id === action.bodyId);
      if (!body || body.status !== "saved")
        return fail("Для поднятия нужно целое, непереработанное тело.");
      bodies = bodies.map((b) =>
        b === body ? { ...b, status: "raised", condition: "" } : b,
      );
    } else {
      if (!action.name?.trim())
        return fail("Укажите имя или описание поднимаемого тела.");
      bodies = [
        ...bodies,
        {
          id: crypto.randomUUID(),
          name: action.name.trim(),
          description: "",
          hp: null,
          maxHp: null,
          notes: "",
          status: "raised",
          condition: "",
          gained: null,
        },
      ];
    }
  }
  const label =
    action.type === "raise"
      ? "Поднять мертвеца"
      : action.type === "heal"
        ? `Регенерация Туши: +${actual} HP`
        : action.label;
  return {
    state: {
      ...state,
      bodies,
      current: state.current - actual,
      log: [
        { id: crypto.randomUUID(), label, cost: actual, timestamp: Date.now() },
        ...state.log,
      ],
    },
    ...(action.type === "heal" ? { hp: core.hp! + actual } : {}),
  };
}
export const smarchokPlugin = {
  initial: initialSmarchok,
  decode: decodeSmarchok,
};
