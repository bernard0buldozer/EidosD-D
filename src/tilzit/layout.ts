export const blockIds = [
  "attributes",
  "health",
  "stances",
  "skills",
  "attacks",
  "abilities",
  "equipment",
  "rolls",
  "history",
  "notes",
] as const;
export type BlockId = (typeof blockIds)[number];
export interface BlockLayout {
  id: BlockId;
  width: number;
  height: number;
  collapsed: boolean;
}
export interface PlacedBlock extends BlockLayout {
  x: number;
  y: number;
}
export const layoutKey = "eidos:layout:tilzit:v1";
const dimensions: Record<BlockId, [number, number]> = {
  attributes: [8, 11],
  health: [8, 11],
  stances: [8, 14],
  skills: [6, 17],
  attacks: [6, 20],
  abilities: [6, 18],
  equipment: [6, 18],
  rolls: [6, 17],
  history: [6, 17],
  notes: [6, 14],
};
export const defaultLayout = (): BlockLayout[] =>
  blockIds.map((id) => ({
    id,
    width: dimensions[id][0],
    height: dimensions[id][1],
    collapsed: false,
  }));
export function decodeLayout(raw: string | null): BlockLayout[] {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (saved?.version !== 1 || !Array.isArray(saved.blocks))
      return defaultLayout();
    const seen = new Set<BlockId>();
    const result: BlockLayout[] = [];
    for (const b of saved.blocks)
      if (b && blockIds.includes(b.id) && !seen.has(b.id)) {
        seen.add(b.id);
        const defaults = dimensions[b.id as BlockId];
        result.push({
          id: b.id,
          width: Number.isInteger(b.width)
            ? Math.max(4, Math.min(12, b.width))
            : defaults[0],
          height: Number.isInteger(b.height)
            ? Math.max(7, Math.min(36, b.height))
            : defaults[1],
          collapsed: b.collapsed === true,
        });
      }
    return [...result, ...defaultLayout().filter((b) => !seen.has(b.id))];
  } catch {
    return defaultLayout();
  }
}
/** First-fit grid packing reserves the portrait and cannot overlap tiles. */
export function packLayout(blocks: BlockLayout[]): PlacedBlock[] {
  const occupied: { x: number; y: number; width: number; height: number }[] = [
    { x: 0, y: 0, width: 4, height: 36 },
  ];
  return blocks.map((block) => {
    const height = block.collapsed ? 2 : block.height;
    for (let y = 0; y < 1000; y++)
      for (let x = 0; x <= 12 - block.width; x++) {
        if (
          occupied.some(
            (b) =>
              x < b.x + b.width &&
              x + block.width > b.x &&
              y < b.y + b.height &&
              y + height > b.y,
          )
        )
          continue;
        occupied.push({ x, y, width: block.width, height });
        return { ...block, x, y };
      }
    throw new Error("Не удалось разместить блоки.");
  });
}
export function moveBlock(
  blocks: BlockLayout[],
  from: BlockId,
  target: BlockId,
) {
  const moved = blocks.find((b) => b.id === from);
  if (!moved || from === target) return blocks;
  const next = blocks.filter((b) => b.id !== from);
  const index = blocks.findIndex((b) => b.id === target);
  next.splice(index, 0, moved);
  return next;
}
