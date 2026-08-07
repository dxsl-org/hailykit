export type WorkflowArm = 'base' | 'candidate';

export interface WorkflowBlock {
  fixtureId: string;
  repeat: number;
}

export interface ScheduledWorkflowArm extends WorkflowBlock {
  pairId: string;
  blockId: string;
  arm: WorkflowArm;
  orderIndex: number;
}

export function scheduleWorkflowPairs(blocks: WorkflowBlock[], seed: number): ScheduledWorkflowArm[] {
  const shuffled = [...blocks];
  const random = mulberry32(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.flatMap((block, blockIndex) => {
    const pairId = `${block.fixtureId}#${block.repeat}`;
    const blockId = `block-${String(blockIndex + 1).padStart(4, '0')}`;
    const firstArm: WorkflowArm = (blockIndex + seed) % 2 === 0 ? 'base' : 'candidate';
    const secondArm: WorkflowArm = firstArm === 'base' ? 'candidate' : 'base';
    return [
      { ...block, pairId, blockId, arm: firstArm, orderIndex: blockIndex * 2 },
      { ...block, pairId, blockId, arm: secondArm, orderIndex: blockIndex * 2 + 1 },
    ];
  });
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
