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
  className: string;
  level: number;
  archetype: string;
  maxHp: number;
  speed: { value: number; unit: string };
  attributes: Attribute[];
  resources: ResourceDefinition[];
  mechanicId: string;
}
export interface CharacterSession {
  hp: number;
  name: string;
  wallet: string;
  notes: string;
  portrait: string | null;
}
export type DieSides = 4 | 8 | 20;
export type RollKind = "attribute" | "attack" | "damage" | "parry" | "manual";
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
}
