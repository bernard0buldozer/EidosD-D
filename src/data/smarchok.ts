import { warrior } from "./warrior";
import type { CharacterDefinition, Skill } from "../domain/types";
// Explicit bonuses printed on the supplied reference; no inferred proficiency formula.
export const smarchokSkills: Skill[] = [
  ["Атлетика", 0],
  ["Акробатика", 2],
  ["Внимательность", 2],
  ["Выживание", 2],
  ["Запугивание", -1],
  ["История", 1],
  ["Ловкость рук", 2],
  ["Магия", 1],
  ["Медицина", 2],
  ["Обман", -1],
  ["Природа", 1],
  ["Проницательность", 2],
  ["Убеждение", -1],
  ["Религия", 1],
  ["Скрытность", 2],
  ["Уход за животными", -1],
  ["Фокусировка", 2],
  ["Починка", 0],
].map(([name, bonus], i) => ({
  id: `reference-${i}`,
  name: String(name),
  bonus: Number(bonus),
}));

export const smarchok: CharacterDefinition = {
  id: "smarchok",
  name: "Смарчок",
  skills: smarchokSkills,
  className: "Некромант",
  archetype: "Грибной симбионт",
  level: null,
  maxHp: null,
  speed: { value: null, unit: "клеток" },
  resources: [],
  mechanicId: "smarchok-mycelium",
  attributes: warrior.attributes.map((a, i) => ({
    ...a,
    score: [10, 14, 12, 13, 15, 8][i],
    modifier: [0, 2, 1, 1, 2, -1][i],
  })),
};
