const palette = ["#70d8ed", "#b9a4ff", "#80dfb4", "#ffc77e", "#f09fbb", "#87aaff", "#e5a8ee", "#a4dca4", "#f69c83", "#d4c477", "#75d2cb", "#d5a1cb"];
export function operationColor(operation: string): string {
  let hash = 2166136261;
  for (const char of operation.toLowerCase()) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return palette[(hash >>> 0) % palette.length];
}
export function logOperation(message: string, type: string): string {
  const audit = message.match(/^\[AUDIT\]\s+([^:]+):/i);
  return audit ? audit[1].toLowerCase() : type;
}
