/**
 * Utilities for MetaTrader 5 integration.
 * Handles MT5 .set file generation, clipboard copying, and optimization range formatting.
 */

export function formatSetFileContent(
  parameters: Record<string, string | number | boolean>,
  metadata?: { setId?: string; eaName?: string; symbol?: string; notes?: string }
): string {
  const lines: string[] = [
    "; -------------------------------------------------------------------",
    `; EA Research Lab — MetaTrader 5 Input Configuration`,
    `; Generated: ${new Date().toISOString()}`,
    metadata?.setId ? `; Stable Set ID: ${metadata.setId}` : "",
    metadata?.eaName ? `; Expert Advisor: ${metadata.eaName}` : "",
    metadata?.symbol ? `; Market Symbol: ${metadata.symbol}` : "",
    metadata?.notes ? `; Notes: ${metadata.notes.replace(/\r?\n/g, " ")}` : "",
    "; -------------------------------------------------------------------",
    "",
  ].filter(Boolean);

  const sortedKeys = Object.keys(parameters).sort();
  for (const key of sortedKeys) {
    const val = parameters[key];
    lines.push(`${key}=${val}`);
  }

  return lines.join("\r\n") + "\r\n";
}

export function downloadSetFile(
  parameters: Record<string, string | number | boolean>,
  filename: string,
  metadata?: { setId?: string; eaName?: string; symbol?: string; notes?: string }
) {
  const content = formatSetFileContent(parameters, metadata);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".set") ? filename : `${filename}.set`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export interface ParameterRange {
  name: string;
  value: number;
  start: number;
  step: number;
  stop: number;
}

/**
 * Calculates a tight optimization range around a baseline numeric parameter value (for Step 8: Narrow Range)
 */
export function calculateNarrowRange(name: string, value: number): ParameterRange {
  // If integer vs decimal
  const isInteger = Number.isInteger(value);
  if (value === 0) {
    return { name, value, start: -5, step: 1, stop: 5 };
  }

  const absVal = Math.abs(value);
  let step: number;
  let delta: number;

  if (isInteger) {
    if (absVal <= 10) {
      step = 1;
      delta = 3;
    } else if (absVal <= 50) {
      step = 2;
      delta = 8;
    } else if (absVal <= 200) {
      step = 5;
      delta = 20;
    } else {
      step = Math.max(1, Math.round(absVal * 0.05));
      delta = Math.max(step * 3, Math.round(absVal * 0.15));
    }
  } else {
    // Float values (e.g. 0.3, 1.5)
    if (absVal < 1) {
      step = 0.05;
      delta = 0.15;
    } else if (absVal < 5) {
      step = 0.1;
      delta = 0.4;
    } else {
      step = 0.5;
      delta = 2.0;
    }
  }

  const start = Math.max(0, Number((value - delta).toFixed(4)));
  const stop = Number((value + delta).toFixed(4));
  return { name, value, start, step: Number(step.toFixed(4)), stop };
}

/**
 * Formats parameters as MT5 Strategy Tester inputs format:
 * Variable=Value||Start||Step||Stop||Y
 */
export function formatMT5OptimizationInputs(ranges: ParameterRange[], staticParams: Record<string, string | number | boolean>): string {
  const lines: string[] = [
    "; MT5 Strategy Tester Input Configuration",
    "; Format: Variable=Value||Start||Step||Stop||Enable(Y/N)",
    "",
  ];

  for (const r of ranges) {
    lines.push(`${r.name}=${r.value}||${r.start}||${r.step}||${r.stop}||Y`);
  }

  for (const [k, v] of Object.entries(staticParams)) {
    if (!ranges.some(r => r.name === k)) {
      lines.push(`${k}=${v}||0||0||0||N`);
    }
  }

  return lines.join("\r\n");
}
