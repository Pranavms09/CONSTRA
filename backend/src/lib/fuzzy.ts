// Port of rapidfuzz fuzz.ratio / fuzz.token_set_ratio / process.extractOne (scores 0-100).

function lcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Normalized Indel similarity, like rapidfuzz fuzz.ratio. */
export function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  return total === 0 ? 100 : (200 * lcsLength(a, b)) / total;
}

export function tokenSetRatio(s1: string, s2: string): number {
  const t1 = new Set(s1.split(/\s+/).filter(Boolean));
  const t2 = new Set(s2.split(/\s+/).filter(Boolean));
  if (!t1.size || !t2.size) return 0;
  const inter = [...t1].filter((t) => t2.has(t)).sort();
  const diff12 = [...t1].filter((t) => !t2.has(t)).sort();
  const diff21 = [...t2].filter((t) => !t1.has(t)).sort();
  if (inter.length && (!diff12.length || !diff21.length)) return 100;

  const sect = inter.join(" ");
  const ab = [sect, diff12.join(" ")].filter(Boolean).join(" ");
  const ba = [sect, diff21.join(" ")].filter(Boolean).join(" ");
  const scores = [ratio(ab, ba)];
  if (sect) scores.push(ratio(sect, ab), ratio(sect, ba));
  return Math.max(...scores);
}

export function extractOne(query: string, choices: string[]): [string, number] | null {
  let best: [string, number] | null = null;
  for (const choice of choices) {
    const score = tokenSetRatio(query.toLowerCase(), choice.toLowerCase());
    if (!best || score > best[1]) best = [choice, score];
  }
  return best;
}
