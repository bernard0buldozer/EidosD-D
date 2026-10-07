import type { DieSides } from "../domain/types";
export function DiceVisualizer({
  sides,
  value,
  rolling,
  selected = true,
}: {
  sides: DieSides;
  value: number;
  rolling: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={`dice-visualizer ${rolling ? "rolling" : ""} ${selected ? "selected" : "discarded"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 110">
        {sides === 20 ? (
          <>
            <path d="M50 5 92 30v50L50 105 8 80V30Z" />
            <path
              d="m50 5-24 64 66-39-66 39 66 11-42-75m-42 25 42 14 42-14M8 80l18-11 24 36 22-36 20 11M26 69l24-25 22 25"
              className="dice-facets"
            />
          </>
        ) : sides === 8 ? (
          <>
            <path d="m50 5 43 50-43 50L7 55Z" />
            <path d="M50 5v100M7 55h86" className="dice-facets" />
          </>
        ) : (
          <>
            <path d="m50 7 45 92H5Z" />
            <path d="M50 7v62L5 99m45-30 45 30" className="dice-facets" />
          </>
        )}
        <text x="50" y="65" textAnchor="middle">
          {rolling ? "·" : value}
        </text>
      </svg>
    </div>
  );
}
