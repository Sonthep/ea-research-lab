import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import { number } from "@/lib/api";
import type { CandidateDetail, MetricSet, OverallStatus, PipelineStage, Status, ValidationRecord, Warning } from "@/types";

const STATUS: Record<Status, { text: string; cls: string; Icon: typeof Clock }> = {
  NOT_TESTED: { text: "Not Tested", cls: "neutral", Icon: MinusCircle },
  RUNNING: { text: "Running", cls: "yellow", Icon: Clock },
  PASSED: { text: "Passed", cls: "", Icon: CheckCircle2 },
  WARNING: { text: "Warning", cls: "yellow", Icon: AlertTriangle },
  FAILED: { text: "Failed", cls: "danger", Icon: XCircle },
};
const OVERALL: Record<OverallStatus, { text: string; cls: string }> = {
  DISCOVERED: { text: "DISCOVERED · NOT VALIDATED", cls: "neutral" }, VALIDATING: { text: "VALIDATING", cls: "yellow" },
  FAILED: { text: "FAILED", cls: "danger" }, LIVE_CANDIDATE: { text: "LIVE CANDIDATE", cls: "" },
};
export const METRIC_ROWS: [string, keyof MetricSet, number][] = [["Profit", "profit", 2], ["Equity DD %", "equity_dd", 2], ["Profit Factor", "profit_factor", 2], ["Recovery Factor", "recovery_factor", 2], ["Sharpe", "sharpe", 2], ["Trades", "trades", 0], ["Win Rate %", "win_rate", 1]];

export function StatusBadge({ status }: { status: Status }) { const s = STATUS[status]; return <span className={`badge ${s.cls}`}>{s.text.toUpperCase()}</span>; }
export function OverallBadge({ status }: { status: OverallStatus }) { const s = OVERALL[status]; return <span className={`badge ${s.cls}`} data-testid="overall-status">{s.text}</span>; }

export function PipelineView({ stages, setId, layout = "vertical" }: { stages: PipelineStage[]; setId?: string; layout?: "vertical" | "horizontal" }) {
  return <ol className={`pipeline ${layout}`} aria-label={`Validation pipeline ${setId ?? ""}`}>{stages.map(stage => {
    const { Icon, text, cls } = STATUS[stage.status];
    const display = stage.status === "NOT_TESTED" ? (stage.detail || text) : stage.status === "RUNNING" ? "Pending" : text;
    return <li key={stage.key} className={`pipeline-stage ${stage.status.toLowerCase()}`} title={stage.detail}>
      <Icon size={16} className={`pipeline-icon ${cls}`} /><span className="pipeline-label">{stage.label}{stage.required ? "" : " (optional)"}</span><span className="pipeline-status">{display}</span>
    </li>;
  })}</ol>;
}

export interface CompareColumn { title: string; subtitle?: string; metrics: Partial<MetricSet>; status?: Status; warnings?: Warning[] }

export function ComparisonTable({ columns }: { columns: CompareColumn[] }) {
  const base = columns[0];
  const flagged = (col: CompareColumn, key: string) => col.warnings?.some(w => w.metric === key);
  return <div className="table-wrap"><table className="comparison">
    <thead><tr><th>Metric</th>{columns.map((c, i) => <th key={i}>{c.title}{c.subtitle && <small>{c.subtitle}</small>}{c.status && <StatusBadge status={c.status} />}</th>)}</tr></thead>
    <tbody>{METRIC_ROWS.map(([label, key, digits]) => <tr key={key}><td>{label}</td>{columns.map((c, i) => {
      const value = c.metrics[key] ?? null, b = base.metrics[key] ?? null;
      const change = i > 0 && value != null && b ? ((value - b) / Math.abs(b)) * 100 : null;
      return <td key={i} className={`mono ${flagged(c, key) ? "amber" : ""}`}>{number(value, digits)}{change != null && <small className={change < 0 ? "delta-down" : "delta-up"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</small>}</td>;
    })}</tr>)}</tbody>
  </table>{columns.flatMap((c, i) => (c.warnings ?? []).map((w, j) => <p key={`${i}-${j}`} className="warning-line"><AlertTriangle size={13} /> <b>{c.title}:</b> {w.message}</p>))}</div>;
}

export function recordColumn(r: ValidationRecord, title = r.label): CompareColumn {
  return { title, subtitle: r.baseline_source === "real_tick" ? "vs Real Tick" : undefined, metrics: r.metrics, status: r.status, warnings: r.comparison.warnings };
}

/** Latest record per label so replaced tests do not clutter comparisons. */
export function latest(records: ValidationRecord[], stages: string[]) {
  const map = new Map<string, ValidationRecord>();
  records.filter(r => stages.includes(r.stage)).forEach(r => map.set(`${r.stage}:${r.label}`, r));
  return Array.from(map.values());
}

export function RobustnessCharts({ record }: { record: ValidationRecord }) {
  const points = record.evidence.points ?? [], twoD = points.some(p => p.y !== null);
  const pf = points.map(p => p.profit_factor), max = Math.max(...pf, 1), min = Math.min(...pf, 0);
  const xs = Array.from(new Set(points.map(p => p.x))).sort((a, b) => a - b), ys = Array.from(new Set(points.map(p => p.y))).sort((a, b) => (a ?? 0) - (b ?? 0));
  const shade = (p: { profit_factor: number }) => `hsl(${Math.round(Math.max(0, Math.min(1, (p.profit_factor - min) / (max - min || 1))) * 130)} 55% 62%)`;
  return <div className="robustness">
    <p className={`robust-class ${record.evidence.classification}`}><b>{record.evidence.classification?.replace("_", " ")}</b> — {record.evidence.message}</p>
    {!twoD && <div className="bar-chart" role="img" aria-label="Profit factor by parameter value">{[...points].sort((a, b) => a.x - b.x).map(p => <div key={p.x} className={`bar-col ${p.is_candidate ? "is-candidate" : ""}`}><div className="bar" style={{ height: `${Math.max(4, ((p.profit_factor - min) / (max - min || 1)) * 100)}%`, background: shade(p) }} /><b className="mono">{number(p.profit_factor, 2)}</b><small>{p.x}</small></div>)}</div>}
    {twoD && <div className="heatmap" style={{ gridTemplateColumns: `auto repeat(${xs.length}, minmax(48px, 1fr))` }} role="img" aria-label="Profit factor heatmap">
      <span />{xs.map(x => <small key={x}>{x}</small>)}
      {ys.map(y => [<small key={`y${y}`}>{y}</small>, ...xs.map(x => { const p = points.find(q => q.x === x && q.y === y); return p ? <div key={`${x}-${y}`} className={`heat-cell ${p.is_candidate ? "is-candidate" : ""}`} style={{ background: shade(p) }} title={`PF ${p.profit_factor} · Profit ${p.profit}`}>{number(p.profit_factor, 2)}</div> : <div key={`${x}-${y}`} className="heat-cell empty">—</div>; })])}
    </div>}
    <div className="table-wrap"><table className="comparison"><thead><tr><th>{String(record.settings.parameter)}{twoD && ` / ${record.settings.parameter_y}`}</th><th>Profit</th><th>Equity DD %</th><th>PF</th><th>Trades</th><th>Result</th></tr></thead>
      <tbody>{[...points].sort((a, b) => a.x - b.x || (a.y ?? 0) - (b.y ?? 0)).map((p, i) => <tr key={i} className={p.is_candidate ? "candidate-row" : ""}><td className="mono">{p.x}{p.y !== null && ` / ${p.y}`}{p.is_candidate && " ◄ candidate"}</td><td className="mono">{number(p.profit)}</td><td className="mono">{number(p.equity_dd)}</td><td className="mono">{number(p.profit_factor)}</td><td className="mono">{number(p.trades, 0)}</td><td>{p.good ? <span className="green">Good</span> : <span className="amber">Weak</span>}</td></tr>)}</tbody></table></div>
  </div>;
}

export function MethodBlock({ candidate }: { candidate: Pick<CandidateDetail, "discovery_method" | "validation_method" | "validation_status" | "overall_status"> }) {
  const m = candidate.discovery_method;
  return <div className="method-block"><div><small>Discovery Method</small><p>{m.optimization_algorithm || "Algorithm not supplied"} / {m.criterion || "Criterion not supplied"} / {m.modelling_method || "Modelling not supplied"}</p></div>
    <div><small>Validation Method</small><p>{candidate.validation_method}</p></div></div>;
}
