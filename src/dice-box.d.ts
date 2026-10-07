declare module "@3d-dice/dice-box" {
  export interface PhysicalDie {
    sides: number;
    value: number;
  }
  export default class DiceBox {
    constructor(options: Record<string, unknown>);
    init(): Promise<void>;
    roll(notation: string[]): Promise<PhysicalDie[]>;
    clear(): void;
  }
}
