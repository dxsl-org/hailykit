export function seededBlockBootstrapCi(blockMeans: number[], seed: number, iterations: number): [number, number] {
  if (!Number.isInteger(iterations) || iterations < 100) throw new Error('bootstrap iterations must be an integer >= 100');
  if (blockMeans.length === 1) return [blockMeans[0], blockMeans[0]];
  const random = mulberry32(seed);
  const samples = Array.from({ length: iterations }, () => {
    let sum = 0;
    for (let index = 0; index < blockMeans.length; index += 1) sum += blockMeans[Math.floor(random() * blockMeans.length)];
    return sum / blockMeans.length;
  }).sort((a, b) => a - b);
  return [quantile(samples, 0.025), quantile(samples, 0.975)];
}

export function pairedPermutationPValue(deltas: number[], seed: number): number {
  const observed = Math.abs(average(deltas));
  if (observed === 0) return 1;
  const exact = deltas.length <= 16;
  const iterations = exact ? 2 ** deltas.length : 4096;
  const random = mulberry32(seed ^ 0x9E3779B9);
  let extreme = 0;
  for (let sample = 0; sample < iterations; sample += 1) {
    const mean = average(deltas.map((value, index) => {
      const negative = exact ? ((sample >> index) & 1) === 1 : random() < 0.5;
      return negative ? -value : value;
    }));
    if (Math.abs(mean) >= observed - Number.EPSILON) extreme += 1;
  }
  return exact ? extreme / iterations : (extreme + 1) / (iterations + 1);
}

function quantile(sorted: number[], probability: number): number { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * (sorted.length - 1))))]; }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function mulberry32(seed: number): () => number { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let value = Math.imul(state ^ (state >>> 15), 1 | state); value ^= value + Math.imul(value ^ (value >>> 7), 61 | value); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; }; }
