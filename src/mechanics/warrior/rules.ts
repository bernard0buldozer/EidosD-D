import type { Roll } from "../../domain/types";
import { stances, type StanceId } from "./config";
export type ActionSlot = "main" | "bonus" | "reaction";
export type AttackOrigin = "main" | "finisher" | "counter";
export interface PendingAttack {
  origin: AttackOrigin;
  stance: StanceId;
  roll: Roll;
  hit: boolean;
  damage: Roll | null;
  critical: boolean;
}
export interface PendingReaction {
  kind: "cover" | "parry";
  roll: Roll | null;
}
export interface WarriorState {
  phase: "preparation" | "combat";
  round: number;
  stance: StanceId;
  spent: Record<ActionSlot, boolean>;
  bonusShift: boolean;
  freeShift: string | null;
  finisher: boolean;
  counter: { critical: boolean } | null;
  attack: PendingAttack | null;
  reaction: PendingReaction | null;
}
export function initialWarriorState(): WarriorState {
  return {
    phase: "preparation",
    round: 1,
    stance: "shield",
    spent: { main: false, bonus: false, reaction: false },
    bonusShift: false,
    freeShift: null,
    finisher: false,
    counter: null,
    attack: null,
    reaction: null,
  };
}
export type WarriorEvent =
  | { type: "start-combat" }
  | { type: "preparation" }
  | { type: "new-round" }
  | { type: "shift"; stance: StanceId }
  | { type: "attack"; origin: AttackOrigin; roll: Roll }
  | { type: "hit" }
  | { type: "miss" }
  | { type: "damage"; roll: Roll }
  | { type: "finish-attack"; killed: boolean; pushed: boolean }
  | { type: "reaction" }
  | { type: "parry-roll"; roll: Roll }
  | { type: "resolve-reaction"; success: boolean; natural: number | null };
export function shiftPermission(state: WarriorState): {
  mode: "manual" | "free" | "bonus" | "blocked";
  reason: string;
} {
  if (state.attack || state.reaction || state.counter)
    return { mode: "blocked", reason: "Сначала завершите текущее действие." };
  if (state.phase === "preparation")
    return {
      mode: "manual",
      reason: "Ручной выбор до начала боя · без расхода действий",
    };
  if (state.freeShift)
    return { mode: "free", reason: `Бесплатная смена: ${state.freeShift}` };
  if (state.bonusShift && !state.spent.bonus)
    return {
      mode: "bonus",
      reason: "Смена за бонусное действие · после успешной атаки",
    };
  return {
    mode: "blocked",
    reason: state.spent.bonus
      ? "Бонусное действие потрачено. Нужен бесплатный триггер."
      : "В бою сначала нужна успешная собственная атака или бесплатный триггер.",
  };
}
export function canAttack(state: WarriorState, origin: AttackOrigin): boolean {
  if (state.attack || state.reaction) return false;
  if (origin === "counter") return !!state.counter;
  if (state.counter) return false;
  return origin === "main"
    ? !state.spent.main
    : state.stance === "assault" && state.finisher && !state.spent.bonus;
}
export function canReact(state: WarriorState): boolean {
  return (
    !!stances[state.stance].reactionName &&
    !state.spent.reaction &&
    !state.attack &&
    !state.reaction &&
    !state.counter
  );
}
export function warriorReducer(
  state: WarriorState,
  event: WarriorEvent,
): WarriorState {
  switch (event.type) {
    case "start-combat":
      return { ...state, phase: "combat" };
    case "preparation":
      return { ...initialWarriorState(), stance: state.stance };
    case "new-round":
      return {
        ...initialWarriorState(),
        phase: "combat",
        round: state.round + 1,
        stance: state.stance,
      };
    case "shift": {
      const permission = shiftPermission(state);
      if (permission.mode === "blocked" || event.stance === state.stance)
        return state;
      return {
        ...state,
        stance: event.stance,
        spent: {
          ...state.spent,
          bonus: state.spent.bonus || permission.mode === "bonus",
        },
        freeShift: permission.mode === "free" ? null : state.freeShift,
        finisher: false,
      };
    }
    case "attack": {
      if (!canAttack(state, event.origin)) return state;
      return {
        ...state,
        phase: "combat",
        spent: {
          ...state.spent,
          main: state.spent.main || event.origin === "main",
          bonus: state.spent.bonus || event.origin === "finisher",
        },
        finisher: event.origin === "finisher" ? false : state.finisher,
        counter: event.origin === "counter" ? null : state.counter,
        attack: {
          origin: event.origin,
          stance: state.stance,
          roll: event.roll,
          hit: false,
          damage: null,
          critical: event.origin === "counter" && !!state.counter?.critical,
        },
      };
    }
    case "hit":
      return state.attack && !state.attack.hit
        ? { ...state, attack: { ...state.attack, hit: true } }
        : state;
    case "miss":
      return state.attack && !state.attack.hit
        ? { ...state, attack: null }
        : state;
    case "damage":
      return state.attack?.hit && !state.attack.damage
        ? { ...state, attack: { ...state.attack, damage: event.roll } }
        : state;
    case "finish-attack": {
      if (!state.attack?.hit || !state.attack.damage) return state;
      return {
        ...state,
        attack: null,
        bonusShift: true,
        freeShift:
          event.pushed && state.attack.stance === "shield"
            ? "успешный толчок"
            : state.freeShift,
        finisher:
          event.killed &&
          state.attack.stance === "assault" &&
          state.attack.origin === "main" &&
          !state.spent.bonus,
      };
    }
    case "reaction": {
      if (!canReact(state)) return state;
      return {
        ...state,
        phase: "combat",
        spent: { ...state.spent, reaction: true },
        reaction: {
          kind: state.stance === "shield" ? "cover" : "parry",
          roll: null,
        },
      };
    }
    case "parry-roll":
      return state.reaction?.kind === "parry" && !state.reaction.roll
        ? { ...state, reaction: { ...state.reaction, roll: event.roll } }
        : state;
    case "resolve-reaction": {
      if (!state.reaction) return state;
      const parry = state.reaction.kind === "parry";
      // No automatic success inference: the GM confirms it explicitly.
      const natural = state.reaction.roll?.values[0] ?? event.natural;
      if (
        parry &&
        event.success &&
        (natural === null ||
          !Number.isInteger(natural) ||
          natural < 1 ||
          natural > 20)
      )
        return state;
      return {
        ...state,
        reaction: null,
        freeShift: event.success
          ? parry
            ? "успешное парирование"
            : "успешное прикрытие"
          : state.freeShift,
        counter:
          event.success && parry ? { critical: natural === 20 } : state.counter,
      };
    }
  }
}
