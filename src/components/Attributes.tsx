import type { Attribute, CharacterDefinition } from "../domain/types";
import { signed } from "../domain/dice";
import {
  Brain,
  CircleUserRound,
  Dumbbell,
  Eye,
  Heart,
  Wind,
  Sparkles,
  Dices,
} from "./Icons";
import { SectionTitle } from "./SectionTitle";
const attributeIcons = {
  strength: Dumbbell,
  dexterity: Wind,
  constitution: Heart,
  intelligence: Brain,
  wisdom: Eye,
  charisma: CircleUserRound,
};
export function Attributes({
  character,
  onRoll,
  rolling,
}: {
  character: CharacterDefinition;
  onRoll: (a: Attribute) => void;
  rolling: boolean;
}) {
  return (
    <section
      className="attributes panel"
      id="attributes"
      aria-label="Характеристики"
    >
      <SectionTitle
        icon={<Sparkles size={19} />}
        title="Характеристики"
        trailing={<span className="hint">Нажмите, чтобы бросить d20</span>}
      />
      <div className="attribute-grid">
        {character.attributes.map((a) => {
          const Icon = attributeIcons[a.id];
          return (
            <button
              key={a.id}
              className="attribute"
              onClick={() => onRoll(a)}
              disabled={rolling}
              aria-label={`${a.checkLabel}, ${signed(a.modifier)}`}
            >
              <div className="attribute-name">
                <Icon size={18} />
                <span>{a.name}</span>
              </div>
              <div className="attribute-values">
                <span className="score">{a.score}</span>
                <strong>{signed(a.modifier)}</strong>
                <span className="small-die">
                  d20 <Dices size={10} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
