export type AttributeId =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";
export interface Attribute {
  id: AttributeId;
  name: string;
  short: string;
  checkLabel: string;
  score: number;
  modifier: number;
}
export interface ResourceDefinition {
  id: string;
  name: string;
  maximum: number | null;
}
/** Shared character data deliberately contains no Warrior-specific mechanics. */
export interface CharacterDefinition {
  id: string;
  name: string;
  skills?: Skill[];
  className: string;
  level: number | null;
  archetype: string;
  maxHp: number | null;
  speed: { value: number | null; unit: string };
  attributes: Attribute[];
  resources: ResourceDefinition[];
  mechanicId: string;
  calculatedModifiers?: boolean;
}
export interface Biography {
  nickname: string;
  race: string;
  className: string;
  age: number | null;
  height: number | null;
  weight: number | null;
  clan: string;
  backstory: string;
  goals: string;
}
export interface EditableAttack {
  id: string;
  name: string;
  bonus: number | null;
  damage: string;
  damageType: string;
}
export interface EditableAbility {
  id: string;
  name: string;
  description: string;
  conditions: string;
  current: number | null;
  maximum: number | null;
}
export interface TilzitDetails {
  biography: Biography;
  weapons: Record<
    "shield" | "sword",
    { bonus: number | null; damage: string; damageType: string }
  >;
  attacks: EditableAttack[];
  abilities: EditableAbility[];
}
export interface CharacterSession {
  hp: number | null;
  maxHp: number | null;
  level: number | null;
  defense: number | null;
  speed: number | null;
  attributes: Attribute[];
  name: string;
  wallet: string;
  notes: string;
  portrait: string | null;
  items: InventoryItem[];
  journal: JournalEntry[];
  skills: Skill[];
  proficiencies: string;
  derivedModifiers?: boolean;
  tilzit?: TilzitDetails;
}
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  description: string;
  notes: string;
  category: string;
  equipped: boolean;
}
export interface JournalEntry {
  id: string;
  category: string;
  name: string;
  description: string;
  notes: string;
  status: string;
  met: string;
  timestamp: number;
}
export interface Skill {
  id: string;
  name: string;
  bonus: number | null;
}
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;
export type CheckMode = "normal" | "advantage" | "disadvantage";
export type RollKind =
  | "attribute"
  | "attack"
  | "damage"
  | "parry"
  | "manual"
  | "free"
  | "skill";
export interface DicePool {
  sides: DieSides;
  quantity: number;
}
export interface Roll {
  id: string;
  label: string;
  kind: RollKind;
  sides: DieSides | null;
  values: number[];
  selectedIndex: number;
  modifier: number | null;
  total: number | null;
  critical: boolean;
  timestamp: number;
  pool?: DicePool[];
  dice?: { sides: DieSides; value: number }[];
  disadvantage?: boolean;
  advantage?: boolean;
}
