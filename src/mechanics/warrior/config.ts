import type { DieSides } from "../../domain/types";
export type StanceId = "shield" | "duelist" | "assault";
export interface StanceDefinition {
  id: StanceId;
  name: string;
  defense: number;
  equipment: string;
  subtitle: string;
  attackName: string;
  damageDie: DieSides;
  disadvantage: boolean;
  reactionName: string | null;
  description: string;
}
export const stances: Record<StanceId, StanceDefinition> = {
  shield: {
    id: "shield",
    name: "Стойка щита",
    defense: 15,
    equipment: "Только щит",
    subtitle: "Прикрыть и удержать",
    attackName: "Атака щитом",
    damageDie: 4,
    disadvantage: true,
    reactionName: "Прикрыть союзника",
    description:
      "Примите на себя атаку, направленную в соседнего союзника. После успешного прикрытия или толчка можно бесплатно сменить стойку.",
  },
  duelist: {
    id: "duelist",
    name: "Дуэлянт",
    defense: 10,
    equipment: "Только меч",
    subtitle: "Парировать и ответить",
    attackName: "Атака мечом",
    damageDie: 8,
    disadvantage: false,
    reactionName: "Парирование",
    description:
      "Один раз за раунд реакцией парируйте рукопашную атаку. При успехе атака отменяется, и вы получаете немедленную ответную атаку. Натуральная 20 делает ответ критическим. Затем можно бесплатно сменить стойку.",
  },
  assault: {
    id: "assault",
    name: "Штурм",
    defense: 12,
    equipment: "Меч + щит",
    subtitle: "Победить и продолжить",
    attackName: "Атака мечом",
    damageDie: 8,
    disadvantage: false,
    reactionName: null,
    description:
      "Если основная атака убила противника, потратьте бонусное действие на атаку другой цели. На первом уровне цепочка заканчивается после этой дополнительной атаки.",
  },
};
export const stanceOrder: StanceId[] = ["shield", "duelist", "assault"];
export const isStanceId = (value: unknown): value is StanceId =>
  typeof value === "string" && Object.hasOwn(stances, value);
export const warriorRules = {
  strengthModifier: 2,
  // TODO: rule not defined by game design. No implicit proficiency bonus is added.
  additionalAttackBonus: null,
  // TODO: rule not defined by game design. Roll the raw d20, then ask the GM to resolve.
  parryModifier: null,
  parryDifficulty: null,
  // TODO: rule not defined by game design. Success is confirmed by the player/GM.
  pushDifficulty: null,
  // TODO: rule not defined by game design. Critical damage must be entered manually.
  criticalDamageFormula: null,
  // TODO: rule not defined by game design. Damage types and skill proficiencies are not supplied.
  skillBonuses: null,
  damageTypes: { sword: null, shield: null },
} as const;
