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
  bonus: number;
}
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
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
}
