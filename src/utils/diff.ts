import type { AssistantVersion } from "../types";

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  text: string;
  v1LineNo?: number;
  v2LineNo?: number;
}

export function formatSystemInstruction(v: AssistantVersion): string {
  const sections = [
    `ROLE:\n${v.role.trim()}`,
    `TASK:\n${v.task.trim()}`,
    `RESTRICTIONS:\n${v.restrictions.trim()}`,
    `OUTPUT FORMAT:\n${v.outputFormat.trim()}`,
  ];
  return sections.join("\n\n");
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let v1Line = 1;
  let v2Line = 1;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({
        type: "unchanged",
        text: a[i],
        v1LineNo: v1Line++,
        v2LineNo: v2Line++,
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({
        type: "removed",
        text: a[i],
        v1LineNo: v1Line++,
      });
      i++;
    } else {
      result.push({
        type: "added",
        text: b[j],
        v2LineNo: v2Line++,
      });
      j++;
    }
  }

  while (i < m) {
    result.push({
      type: "removed",
      text: a[i++],
      v1LineNo: v1Line++,
    });
  }

  while (j < n) {
    result.push({
      type: "added",
      text: b[j++],
      v2LineNo: v2Line++,
    });
  }

  return result;
}
