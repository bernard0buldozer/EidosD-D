import type {
  Attribute,
  CharacterSession,
  DicePool,
  Roll,
} from "../domain/types";
import { appendHistory, manualDamage } from "../domain/dice";
import { warrior } from "../data/warrior";
import { stances } from "../mechanics/warrior/config";
import {
  canAttack,
  initialWarriorState,
  warriorReducer,
  type AttackOrigin,
  type WarriorEvent,
} from "../mechanics/warrior/rules";
import { loadState, validMechanic, type SheetState } from "./persistence";
import { normalizeCore, useCharacter } from "./core";
import { useDice } from "../dice/DiceProvider";
type SheetEvent =
  | { type: "core"; patch: Partial<CharacterSession> }
  | { type: "roll"; roll: Roll }
  | { type: "mechanic"; event: WarriorEvent }
  | { type: "clear-history" };
export function sheetReducer(
  state: SheetState,
  action: SheetEvent,
): SheetState {
  if (action.type === "core")
    return {
      ...state,
      core: normalizeCore({ ...state.core, ...action.patch }),
    };
  if (action.type === "clear-history")
    return { ...state, history: [], lastRoll: null };
  if (action.type === "roll")
    return {
      ...state,
      lastRoll: action.roll,
      history: appendHistory(state.history, action.roll),
    };
  const mechanic = warriorReducer(state.mechanic, action.event);
  if (mechanic === state.mechanic) return state;
  return "roll" in action.event
    ? {
        ...state,
        mechanic,
        lastRoll: action.event.roll,
        history: appendHistory(state.history, action.event.roll),
      }
    : { ...state, mechanic };
}
const plugin = {
  initial: initialWarriorState,
  decode: (v: unknown) => (validMechanic(v) ? v : initialWarriorState()),
};
export function useSheet() {
  const core = useCharacter(warrior, plugin, loadState);
  const dice = useDice();
  const { state } = core;
  const strength = state.core.attributes.find(
    (a) => a.id === "strength",
  )!.modifier;
  const send = (event: WarriorEvent) => {
    const next = warriorReducer(state.mechanic, event);
    if (next === state.mechanic) return;
    core.setMechanic(next);
    if ("roll" in event) core.recordRoll(event.roll);
  };
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
  const attack = async (origin: AttackOrigin) => {
    if (!canAttack(state.mechanic, origin) || dice.rolling) return;
    const stance = stances[state.mechanic.stance];
    const r = await dice.roll({
      label:
        origin === "counter"
          ? "Ответная атака мечом"
          : origin === "finisher"
            ? "Добивание · атака мечом"
            : stance.attackName,
      kind: "attack",
      pool: [{ sides: 20, quantity: stance.disadvantage ? 2 : 1 }],
      modifier: strength,
      disadvantage: stance.disadvantage,
      critical: origin === "counter" && !!state.mechanic.counter?.critical,
    });
    if (r) send({ type: "attack", origin, roll: r });
  };
  const damage = async () => {
    const pending = state.mechanic.attack;
    if (!pending?.hit || pending.damage || pending.critical || dice.rolling)
      return;
    const stance = stances[pending.stance];
    const r = await dice.roll({
      label: stance.id === "shield" ? "Урон щитом" : "Урон мечом",
      kind: "damage",
      pool: [{ sides: stance.damageDie, quantity: 1 }],
      modifier: strength,
    });
    if (r) send({ type: "damage", roll: r });
  };
  const parry = async () => {
    if (!state.mechanic.reaction || state.mechanic.reaction.roll) return;
    const r = await dice.roll({
      label: "Парирование · только d20",
      kind: "parry",
      pool: [{ sides: 20, quantity: 1 }],
      modifier: null,
    });
    if (r) send({ type: "parry-roll", roll: r });
  };
  return {
    ...core,
    rolling: dice.rolling,
    send,
    attack,
    damage,
    parry,
    rollAttribute,
    freeRoll,
    strength,
    criticalDamage: (value: number) => {
      if (
        Number.isInteger(value) &&
        value >= 0 &&
        state.mechanic.attack?.critical
      )
        send({ type: "damage", roll: manualDamage(value) });
    },
  };
}
export type SheetController = ReturnType<typeof useSheet>;
