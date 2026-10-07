import { useEffect, useReducer, useState } from "react";
import type { Attribute, CharacterSession, Roll } from "../domain/types";
import { appendHistory, manualDamage, rollDice } from "../domain/dice";
import { warrior } from "../data/warrior";
import { stances, warriorRules } from "../mechanics/warrior/config";
import {
  canAttack,
  warriorReducer,
  type AttackOrigin,
  type WarriorEvent,
} from "../mechanics/warrior/rules";
import {
  encodeState,
  loadState,
  STORAGE_KEY,
  type SheetState,
} from "./persistence";
type SheetEvent =
  | { type: "core"; patch: Partial<CharacterSession> }
  | { type: "roll"; roll: Roll }
  | { type: "mechanic"; event: WarriorEvent }
  | { type: "clear-history" };
export function sheetReducer(
  state: SheetState,
  action: SheetEvent,
): SheetState {
  if (action.type === "core") {
    const core = { ...state.core, ...action.patch };
    core.hp = Math.max(0, Math.min(warrior.maxHp, Math.trunc(core.hp)));
    return { ...state, core };
  }
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
export function useSheet() {
  const [state, dispatch] = useReducer(sheetReducer, undefined, loadState);
  const [storageOk, setStorageOk] = useState(true);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, encodeState(state));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [state]);
  useEffect(() => {
    if (!state.lastRoll) return;
    setRolling(true);
    const timeout = setTimeout(() => setRolling(false), 480);
    return () => clearTimeout(timeout);
  }, [state.lastRoll]);
  const send = (event: WarriorEvent) => dispatch({ type: "mechanic", event });
  const rollAttribute = (attribute: Attribute) =>
    dispatch({
      type: "roll",
      roll: rollDice({
        label: attribute.checkLabel,
        kind: "attribute",
        sides: 20,
        modifier: attribute.modifier,
      }),
    });
  const attack = (origin: AttackOrigin) => {
    if (!canAttack(state.mechanic, origin)) return;
    const stance = stances[state.mechanic.stance];
    send({
      type: "attack",
      origin,
      roll: rollDice({
        label:
          origin === "counter"
            ? "Ответная атака мечом"
            : origin === "finisher"
              ? "Добивание · атака мечом"
              : stance.attackName,
        kind: "attack",
        sides: 20,
        modifier: warriorRules.strengthModifier,
        disadvantage: stance.disadvantage,
        critical: origin === "counter" && !!state.mechanic.counter?.critical,
      }),
    });
  };
  const damage = () => {
    const pending = state.mechanic.attack;
    if (!pending?.hit || pending.damage || pending.critical) return;
    const stance = stances[pending.stance];
    send({
      type: "damage",
      roll: rollDice({
        label: stance.id === "shield" ? "Урон щитом" : "Урон мечом",
        kind: "damage",
        sides: stance.damageDie,
        modifier: warriorRules.strengthModifier,
      }),
    });
  };
  const parry = () =>
    send({
      type: "parry-roll",
      roll: rollDice({
        label: "Парирование · только d20",
        kind: "parry",
        sides: 20,
        modifier: null,
      }),
    });
  const criticalDamage = (value: number) => {
    if (
      Number.isInteger(value) &&
      value >= 0 &&
      state.mechanic.attack?.critical
    )
      send({ type: "damage", roll: manualDamage(value) });
  };
  return {
    state,
    storageOk,
    rolling,
    send,
    attack,
    damage,
    parry,
    criticalDamage,
    rollAttribute,
    updateCore: (patch: Partial<CharacterSession>) =>
      dispatch({ type: "core", patch }),
    clearHistory: () => dispatch({ type: "clear-history" }),
  };
}
export type SheetController = ReturnType<typeof useSheet>;
