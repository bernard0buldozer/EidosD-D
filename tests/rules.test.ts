import { describe, expect, it } from "vitest";
import {
  rollDice,
  appendHistory,
  manualDamage,
  randomDie,
} from "../src/domain/dice";
import {
  canAttack,
  canReact,
  initialWarriorState,
  shiftPermission,
  warriorReducer as reduce,
  type WarriorState,
  type AttackOrigin,
} from "../src/mechanics/warrior/rules";
import { stances } from "../src/mechanics/warrior/config";
import {
  decodeState,
  encodeState,
  initialSheetState,
} from "../src/state/persistence";
import { sheetReducer } from "../src/state/useSheet";
const attackRoll = () =>
  rollDice(
    { label: "Атака", kind: "attack", sides: 20, modifier: 2 },
    () => 15,
  );
function attack(s: WarriorState, origin: AttackOrigin = "main") {
  return reduce(s, { type: "attack", origin, roll: attackRoll() });
}
function hit(s: WarriorState, killed = false, pushed = false) {
  s = reduce(s, { type: "hit" });
  s = reduce(s, {
    type: "damage",
    roll: rollDice(
      {
        label: "Урон",
        kind: "damage",
        sides: stances[s.stance].damageDie,
        modifier: 2,
      },
      () => 3,
    ),
  });
  return reduce(s, { type: "finish-attack", killed, pushed });
}
function ready(stance: "shield" | "duelist" | "assault" = "shield") {
  return reduce(reduce(initialWarriorState(), { type: "shift", stance }), {
    type: "start-combat",
  });
}
describe("dice", () => {
  it("keeps natural, modifier and total separate", () => {
    const r = rollDice(
      { label: "Харизма", kind: "attribute", sides: 20, modifier: -1 },
      () => 14,
    );
    expect(r.values).toEqual([14]);
    expect(r.modifier).toBe(-1);
    expect(r.total).toBe(13);
  });
  it.each([
    [18, 5, 1, 7],
    [3, 12, 0, 5],
    [8, 8, 0, 10],
  ])("disadvantage %i / %i uses the minimum", (a, b, index, total) => {
    const sequence = [a, b];
    const r = rollDice(
      {
        label: "Щит",
        kind: "attack",
        sides: 20,
        modifier: 2,
        disadvantage: true,
      },
      () => sequence.shift()!,
    );
    expect(r.values).toEqual([a, b]);
    expect(r.selectedIndex).toBe(index);
    expect(r.total).toBe(total);
  });
  it("does not invent a parry modifier", () =>
    expect(
      rollDice(
        { label: "Парирование", kind: "parry", sides: 20, modifier: null },
        () => 20,
      ).total,
    ).toBeNull());
  it.each([4, 8, 20] as const)("RNG produces legal d%i faces", (sides) => {
    for (let n = 0; n < 100; n++) {
      const result = randomDie(sides);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(sides);
    }
  });
  it("keeps the latest ten entries", () => {
    let history: ReturnType<typeof attackRoll>[] = [];
    for (let i = 0; i < 15; i++) history = appendHistory(history, attackRoll());
    expect(history).toHaveLength(10);
    expect(new Set(history.map((r) => r.id)).size).toBe(10);
  });
});
describe("stance and economy rules", () => {
  it("allows manual selection only in preparation", () => {
    const s = reduce(initialWarriorState(), {
      type: "shift",
      stance: "assault",
    });
    expect(s.stance).toBe("assault");
    expect(s.spent.bonus).toBe(false);
    expect(reduce(ready(), { type: "shift", stance: "duelist" }).stance).toBe(
      "shield",
    );
  });
  it("updates defense and equipment for every stance", () => {
    expect(Object.values(stances).map((s) => s.defense)).toEqual([15, 10, 12]);
    expect(stances.shield.damageDie).toBe(4);
    expect(stances.shield.disadvantage).toBe(true);
    expect(stances.duelist.damageDie).toBe(8);
    expect(stances.assault.reactionName).toBeNull();
  });
  it("attack starts combat and consumes one main action", () => {
    const s = attack(initialWarriorState());
    expect(s.phase).toBe("combat");
    expect(s.spent.main).toBe(true);
    expect(attack(s)).toBe(s);
    expect(canAttack(s, "main")).toBe(false);
  });
  it("blocks a reaction while resolving an attack", () =>
    expect(canReact(attack(ready()))).toBe(false));
  it("misses grant no stance trigger", () => {
    const s = reduce(attack(ready()), { type: "miss" });
    expect(s.attack).toBeNull();
    expect(s.bonusShift).toBe(false);
    expect(shiftPermission(s).mode).toBe("blocked");
  });
  it("requires hit and damage before finishing", () => {
    let s = attack(ready());
    expect(
      reduce(s, { type: "finish-attack", killed: true, pushed: true }),
    ).toBe(s);
    expect(reduce(s, { type: "damage", roll: manualDamage(9) })).toBe(s);
    s = reduce(s, { type: "hit" });
    expect(
      reduce(s, { type: "finish-attack", killed: false, pushed: false }),
    ).toBe(s);
  });
  it("cannot reroll damage or relabel a hit as a miss", () => {
    let s = reduce(attack(ready()), { type: "hit" });
    expect(reduce(s, { type: "miss" })).toBe(s);
    s = reduce(s, { type: "damage", roll: manualDamage(8) });
    expect(reduce(s, { type: "damage", roll: manualDamage(12) })).toBe(s);
  });
  it("a successful own attack enables exactly one bonus shift", () => {
    const s = hit(attack(ready()));
    expect(shiftPermission(s).mode).toBe("bonus");
    const shifted = reduce(s, { type: "shift", stance: "assault" });
    expect(shifted.spent.bonus).toBe(true);
    expect(reduce(shifted, { type: "shift", stance: "duelist" })).toBe(shifted);
  });
  it("a confirmed shield push grants a single free shift", () => {
    let s = hit(attack(ready()), false, true);
    expect(shiftPermission(s).mode).toBe("free");
    s = reduce(s, { type: "shift", stance: "duelist" });
    expect(s.freeShift).toBeNull();
    expect(s.spent.bonus).toBe(false);
    expect(shiftPermission(s).mode).toBe("bonus");
  });
  it("cover consumes reaction and grants a free shift only after success", () => {
    let s = reduce(ready(), { type: "reaction" });
    expect(s.spent.reaction).toBe(true);
    expect(s.freeShift).toBeNull();
    s = reduce(s, { type: "resolve-reaction", success: true, natural: null });
    expect(shiftPermission(s).mode).toBe("free");
    expect(canReact(s)).toBe(false);
    expect(reduce(s, { type: "shift", stance: "assault" }).spent.bonus).toBe(
      false,
    );
  });
  it("failed cover creates no free shift", () => {
    const s = reduce(reduce(ready(), { type: "reaction" }), {
      type: "resolve-reaction",
      success: false,
      natural: null,
    });
    expect(s.freeShift).toBeNull();
  });
  it("assault has no cover or parry reaction", () => {
    const s = ready("assault");
    expect(canReact(s)).toBe(false);
    expect(reduce(s, { type: "reaction" })).toBe(s);
  });
  it("one parry attempt per round, including failed attempts", () => {
    let s = reduce(ready("duelist"), { type: "reaction" });
    s = reduce(s, { type: "resolve-reaction", success: false, natural: 8 });
    expect(s.spent.reaction).toBe(true);
    expect(s.counter).toBeNull();
    expect(canReact(s)).toBe(false);
  });
  it("requires a known natural face to determine a successful parry counter", () => {
    const s = reduce(ready("duelist"), { type: "reaction" });
    expect(
      reduce(s, { type: "resolve-reaction", success: true, natural: null }),
    ).toBe(s);
  });
  it.each([19, 20])(
    "parry natural %i grants an immediate counter with correct critical flag",
    (natural) => {
      let s = reduce(ready("duelist"), { type: "reaction" });
      s = reduce(s, { type: "resolve-reaction", success: true, natural });
      expect(s.counter?.critical).toBe(natural === 20);
      expect(shiftPermission(s).mode).toBe("blocked");
      expect(canAttack(s, "main")).toBe(false);
      s = attack(s, "counter");
      expect(s.attack?.critical).toBe(natural === 20);
      expect(s.spent.main).toBe(false);
      expect(s.spent.bonus).toBe(false);
      expect(s.counter).toBeNull();
      s = hit(s);
      expect(shiftPermission(s).mode).toBe("free");
      expect(canAttack(s, "counter")).toBe(false);
    },
  );
  it("the recorded parry die is authoritative over a manual override", () => {
    let s = reduce(ready("duelist"), { type: "reaction" });
    s = reduce(s, {
      type: "parry-roll",
      roll: rollDice(
        { label: "Парирование", kind: "parry", sides: 20, modifier: null },
        () => 20,
      ),
    });
    const before = s;
    s = reduce(s, { type: "parry-roll", roll: attackRoll() });
    expect(s).toBe(before);
    s = reduce(s, { type: "resolve-reaction", success: true, natural: 2 });
    expect(s.counter?.critical).toBe(true);
  });
  it("a kill by a primary assault attack unlocks one finisher", () => {
    let s = hit(attack(ready("assault")), true);
    expect(s.finisher).toBe(true);
    expect(canAttack(s, "finisher")).toBe(true);
    s = attack(s, "finisher");
    expect(s.spent.bonus).toBe(true);
    s = hit(s, true);
    expect(s.finisher).toBe(false);
    expect(canAttack(s, "finisher")).toBe(false);
    expect(shiftPermission(s).mode).toBe("blocked");
  });
  it("nonlethal primary assault attacks do not unlock a finisher", () =>
    expect(hit(attack(ready("assault")), false).finisher).toBe(false));
  it("a bonus shift competes with finisher for the same action", () => {
    let s = hit(attack(ready("assault")), true);
    s = reduce(s, { type: "shift", stance: "shield" });
    expect(s.finisher).toBe(false);
    expect(s.spent.bonus).toBe(true);
  });
  it("new round restores actions and clears all round-local triggers", () => {
    let s = hit(attack(ready()), false, true);
    s = reduce(s, { type: "reaction" });
    s = reduce(s, { type: "resolve-reaction", success: true, natural: null });
    s = reduce(s, { type: "new-round" });
    expect(s.round).toBe(2);
    expect(s.spent).toEqual({ main: false, bonus: false, reaction: false });
    expect(s.bonusShift).toBe(false);
    expect(s.freeShift).toBeNull();
    expect(s.finisher).toBe(false);
    expect(canReact(s)).toBe(true);
  });
});
describe("session and persistence", () => {
  it("clamps HP to zero and maximum without creating death mechanics", () => {
    let s = initialSheetState();
    s = sheetReducer(s, { type: "core", patch: { hp: -99 } });
    expect(s.core.hp).toBe(0);
    s = sheetReducer(s, { type: "core", patch: { hp: 99 } });
    expect(s.core.hp).toBe(12);
  });
  it("saves HP, stance, spent actions, history and pending resolution across reload", () => {
    const s = initialSheetState();
    s.core.hp = 7;
    s.mechanic = attack(ready("duelist"));
    s.history = [s.mechanic.attack!.roll];
    s.lastRoll = s.history[0];
    expect(decodeState(encodeState(s))).toEqual(s);
  });
  it.each(["not-json", "{}", '{"version":20,"state":{}}', "null"])(
    "opens safely with invalid storage %s",
    (raw) => expect(decodeState(raw)).toEqual(initialSheetState()),
  );
  it("rejects malformed mechanic state while retaining valid HP", () => {
    const s = initialSheetState();
    s.core.hp = 6;
    const broken = JSON.parse(encodeState(s));
    broken.state.mechanic.attack = {};
    const result = decodeState(JSON.stringify(broken));
    expect(result.core.hp).toBe(6);
    expect(result.mechanic).toEqual(initialWarriorState());
  });
  it("rejected duplicate action does not add misleading history", () => {
    let s = initialSheetState();
    s = sheetReducer(s, {
      type: "mechanic",
      event: { type: "attack", origin: "main", roll: attackRoll() },
    });
    const again = sheetReducer(s, {
      type: "mechanic",
      event: { type: "attack", origin: "main", roll: attackRoll() },
    });
    expect(again).toBe(s);
    expect(s.history).toHaveLength(1);
  });
});
