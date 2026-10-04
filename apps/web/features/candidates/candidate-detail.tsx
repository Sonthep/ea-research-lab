"use client";
import { useState } from "react";
import Link from "next/link";
import { api, jsonBody } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Heading, ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Download, Workflow } from "lucide-react";
import { downloadSetFile } from "@/lib/mt5";
import { ComparisonTable, MethodBlock, OverallBadge, PipelineView, RobustnessCharts, StatusBadge, latest, recordColumn, METRIC_ROWS } from "@/features/candidates/pipeline";
import type { CandidateDetail, ValidationRecord } from "@/types";

const STAGES: [string, string][] = [["real_tick", "Real Tick"], ["latency", "Latency"], ["random_delay", "Random Delay"], ["slippage", "Slippage (future)"], ["spread", "Spread stress (future)"], ["oos", "Out-of-Sample"], ["forward", "Forward"], ["long_period", "Long Period"], ["cross_broker", "Cross-Broker"], ["demo", "Demo Forward"]];
const REGIMES = [["trend", "Trend"], ["range", "Range"], ["high_volatility", "High volatility"], ["low_volatility", "Low volatility"]] as const;
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div className="panel"><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div><div className="panel-body">{children}</div></div>;
}

function StageForm({ candidate, onSaved }: { candidate: CandidateDetail; onSaved: () => void }) {
  const [stage, setStage] = useState("real_tick"), [f, setF] = useState<Record<string, string>>({}), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const input = (k: string, label: string, type = "text") => <label className="field" key={k}>{label}<input type={type} step="any" value={f[k] ?? ""} onChange={set(k)} /></label>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    const running = f.status === "RUNNING";
    const metrics = Object.fromEntries(METRIC_ROWS.map(([, key]) => [key, num(f[`m_${key}`] ?? "")]).filter(([, v]) => v !== undefined));
    const settings = Object.fromEntries(["delay_ms", "delay_min_ms", "delay_max_ms", "slippage_points", "spread_points", "period_from", "period_to", "broker", "forward_index", "execution_notes"].map(k => [k, ["period_from", "period_to", "broker", "forward_index", "execution_notes"].includes(k) ? (f[k] || undefined) : num(f[k] ?? "")]).filter(([, v]) => v !== undefined));
    const regimes = Object.fromEntries(REGIMES.map(([k]) => [k, { profit: num(f[`r_${k}_profit`] ?? ""), profit_factor: num(f[`r_${k}_pf`] ?? "") }]).filter(([, v]) => (v as { profit?: number }).profit !== undefined || (v as { profit_factor?: number }).profit_factor !== undefined));
    try {
      await api(`/candidates/${candidate.id}/validation/${stage}`, jsonBody({ label: f.label || undefined, status: f.status || undefined, metrics: running && !Object.keys(metrics).length ? undefined : metrics, settings, regimes, notes: f.notes || "" }));
      setMessage("Test recorded."); onSaved();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <div className="form-grid">
      <label className="field">Validation stage<select value={stage} onChange={e => setStage(e.target.value)}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field">Status<select value={f.status ?? ""} onChange={set("status")}><option value="">Calculate from evidence</option><option value="RUNNING">Running (no results yet)</option><option value="PASSED">Passed (manual)</option><option value="WARNING">Warning (manual)</option><option value="FAILED">Failed (manual)</option></select></label>
      {input("label", "Label (optional)")}
      {stage === "latency" && input("delay_ms", "Latency (ms)", "number")}
      {stage === "random_delay" && <>{input("delay_min_ms", "Min delay (ms)", "number")}{input("delay_max_ms", "Max delay (ms)", "number")}</>}
      {stage === "slippage" && input("slippage_points", "Slippage (points)", "number")}
      {stage === "spread" && input("spread_points", "Spread (points)", "number")}
      {stage === "forward" && input("forward_index", "Forward (e.g. 1/3)")}
      {stage === "cross_broker" && <>{input("broker", "Broker")}{input("execution_notes", "Execution differences")}</>}
      {["oos", "long_period", "demo", "forward", "cross_broker"].includes(stage) && <>{input("period_from", "Period from (YYYY-MM-DD)")}{input("period_to", "Period to (YYYY-MM-DD)")}</>}
    </div>
    <h3 className="section-gap">Results</h3>
    <div className="form-grid">{METRIC_ROWS.map(([label, key]) => input(`m_${key}`, label, "number"))}</div>
    {stage === "long_period" && <><h3 className="section-gap">Market regimes (optional)</h3><div className="form-grid">{REGIMES.map(([k, l]) => <div key={k} className="regime-input"><b>{l}</b>{input(`r_${k}_profit`, "Profit", "number")}{input(`r_${k}_pf`, "Profit Factor", "number")}</div>)}</div></>}
    <label className="field section-gap">Notes<textarea value={f.notes ?? ""} onChange={set("notes")} maxLength={5000} /></label>
    <p className="context-note">The same parameters are used; optimization stays disabled. Import the figures from your MT5 report.</p>
    <ErrorBox message={error} />{message && <p className="success" role="status">{message}</p>}
    <div className="form-actions"><Button type="submit" disabled={busy}>Record test</Button></div>
  </form>;
}

function RobustnessForm({ candidate, onSaved }: { candidate: CandidateDetail; onSaved: () => void }) {
  const names = Object.keys(candidate.parameters).filter(k => Number.isFinite(Number(candidate.parameters[k])));
  const [parameter, setParameter] = useState(names[0] ?? ""), [y, setY] = useState(""), [text, setText] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      const points = text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
        const c = line.split(/[,;\s]+/).map(Number);
        return y ? { x: c[0], y: c[1], profit: c[2], equity_dd: c[3], profit_factor: c[4], trades: c[5] } : { x: c[0], profit: c[1], equity_dd: c[2], profit_factor: c[3], trades: c[4] };
      });
      await api(`/candidates/${candidate.id}/validation/robustness`, jsonBody({ parameter, parameter_y: y || undefined, points }));
      setMessage("Robustness test recorded."); onSaved();
    } catch (err) { setError((err as Error).message); }
  }
  return <form onSubmit={submit}><div className="form-grid">
    <label className="field">Parameter<select value={parameter} onChange={e => setParameter(e.target.value)}>{names.map(n => <option key={n}>{n}</option>)}</select></label>
    <label className="field">Second parameter (heatmap, optional)<select value={y} onChange={e => setY(e.target.value)}><option value="">None</option>{names.filter(n => n !== parameter).map(n => <option key={n}>{n}</option>)}</select></label></div>
    <label className="field section-gap">Neighbouring tests, one per line: {y ? "x, y" : "value"}, profit, equity DD %, profit factor, trades
      <textarea aria-label="Robustness points" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={y ? "36, 1.5, 120, 5.1, 2.1, 140" : "34, 90, 6, 1.9, 130\n36, 120, 5, 2.1, 140"} /></label>
    <p className="context-note">Include the candidate&apos;s own value ({candidate.parameters[parameter]}) and at least two neighbours.</p>
    <ErrorBox message={error} />{message && <p className="success" role="status">{message}</p>}<div className="form-actions"><Button type="submit">Record robustness test</Button></div></form>;
}

function Notes({ records }: { records: ValidationRecord[] }) {
  const items = records.filter(r => r.notes || r.status_overridden);
  return items.length ? <ul className="record-notes">{items.map(r => <li key={r.id}><b>{r.label}</b>{r.status_overridden && " · status set manually"}{r.notes && ` — ${r.notes}`}</li>)}</ul> : null;
}

export function CandidateDetailView({ id }: { id: string }) {
  const [revision, setRevision] = useState(0);
  const { data: c, error, loading } = useApi<CandidateDetail>(`/candidates/${id}`, revision);
  const refresh = () => setRevision(r => r + 1);
  if (loading && !c) return <div className="loading">Loading candidate…</div>;
  if (!c) return <ErrorBox message={error || "Candidate not found"} />;
  const b = c.baseline, run = c.run;
  const baselineCol = { title: "Discovery baseline", subtitle: "1 min OHLC · optimization", metrics: b as never };
  const realTick = latest(c.records, ["real_tick"]), stress = latest(c.records, ["latency", "random_delay", "slippage", "spread"]);
  const lastRealTick = realTick[realTick.length - 1];
  const group = (stages: string[]) => latest(c.records, stages);
  const inSample = { title: "In-Sample", subtitle: `${run.date_from ?? "?"} → ${run.date_to ?? "?"}`, metrics: b as never };
  const robustness = group(["robustness"]);
  return <>
    <Heading title={b.stable_set_id} description={`${run.ea_name} · ${run.symbol ?? "Unknown"} · ${run.timeframe ?? "—"}`}>
      <OverallBadge status={c.overall_status} />
      <Button asChild><Link href={`/workflow?candidate=${c.id}&step=3`}><Workflow size={15} />Open in Workflow Stepper</Link></Button>
      <Button variant="outline" onClick={() => downloadSetFile(c.parameters, `${b.stable_set_id}_${run.ea_name}`)}><Download size={15} />Download .set</Button>
      <Button variant="outline" asChild><Link href="/candidates">All candidates</Link></Button>
    </Heading>
    <ErrorBox message={error} />
    <div className="notice">Candidate Discovery only means a promising parameter set was found. Fast genetic optimization results are not validated backtests; Real Tick, OOS, Forward and Robustness provide progressively stronger evidence.</div>
    <div className="two-col">
      <Section title="Candidate Discovery" subtitle="Stage 1 · Optimization on 1 minute OHLC">
        <dl className="meta-grid">{[["Status", "Discovered (not validated)"], ["Optimization Run", run.name], ["EA Name", run.ea_name], ["Symbol", run.symbol], ["Timeframe", run.timeframe], ["Date Range", `${run.date_from ?? "—"} → ${run.date_to ?? "—"}`], ["Algorithm", c.discovery_method.optimization_algorithm], ["Criterion", c.discovery_method.criterion], ["Modelling", c.discovery_method.modelling_method], ["Results", `${run.result_count.toLocaleString()} parameter sets`]].map(([l, v]) => <div key={l as string}><dt>{l}</dt><dd>{v || "Not supplied"}</dd></div>)}</dl>
        <MethodBlock candidate={c} />
        {c.discovery_evidence ? <details className="disclosure"><summary>Candidate Filter · selection #{c.discovery_evidence.batch_id} · rank {c.discovery_evidence.rank}</summary><p>DD ≤ {c.discovery_evidence.policy.max_equity_dd}% · PF ≥ {c.discovery_evidence.policy.min_profit_factor} · Trades ≥ {c.discovery_evidence.policy.min_trades} · Profit &gt; {c.discovery_evidence.policy.profit_above}</p></details> : <p className="context-note">Added manually; no filter policy was recorded.</p>}
      </Section>
      <Section title="Validation pipeline"><PipelineView stages={c.pipeline} setId={b.stable_set_id} /><div className="overall-line">Overall Status: <OverallBadge status={c.overall_status} /></div><p className="context-note">LIVE CANDIDATE requires: {c.rules.required_stages.join(", ").replaceAll("_", " ")}.</p></Section>
    </div>
    <Section title="Real Tick validation" subtitle="Optimization disabled · Every tick based on real ticks · zero latency">
      {realTick.length ? <ComparisonTable columns={[baselineCol, ...realTick.map(r => recordColumn(r, "Real Tick" + (realTick.length > 1 ? ` · ${r.label}` : "")))]} /> : <p className="muted">Not tested. Compare against the discovery baseline once recorded.</p>}<Notes records={realTick} />
    </Section>
    <Section title="Execution stress test" subtitle="Compared with the Real Tick baseline">
      {stress.length && lastRealTick ? <ComparisonTable columns={[{ title: "Real Tick", subtitle: `${lastRealTick.settings.delay_ms ?? 0} ms`, metrics: lastRealTick.metrics, status: lastRealTick.status }, ...stress.map(r => recordColumn(r))]} /> : <p className="muted">No stress tests recorded. Requires a Real Tick result first.</p>}<Notes records={stress} />
    </Section>
    <Section title="Out-of-Sample" subtitle="Same parameters, no re-optimization, data not used for discovery">
      {group(["oos"]).length ? <ComparisonTable columns={[inSample, ...group(["oos"]).map(r => recordColumn(r, `Out-of-Sample`))].map((col, i) => i ? { ...col, subtitle: `${group(["oos"])[i - 1].settings.period_from} → ${group(["oos"])[i - 1].settings.period_to}` } : col)} /> : <p className="muted">Not tested.</p>}<Notes records={group(["oos"])} />
    </Section>
    <Section title="Forward test" subtitle="In-Sample vs Forward">
      {group(["forward"]).length ? <ComparisonTable columns={[inSample, ...group(["forward"]).map(r => recordColumn(r))]} /> : <p className="muted">Not tested.</p>}<Notes records={group(["forward"])} />
    </Section>
    <Section title="Parameter robustness" subtitle="Nearby parameter values · plateau or sensitivity, never an automatic overfitting verdict">
      {robustness.map(r => <div key={r.id} className="section-gap"><h3>{r.label} <StatusBadge status={r.status} /></h3><RobustnessCharts record={r} /></div>)}
      {!robustness.length && <p className="muted">Not tested.</p>}
    </Section>
    <Section title="Long period validation" subtitle="Market regimes · no re-optimization">
      {group(["long_period"]).map(r => <div key={r.id}><ComparisonTable columns={[baselineCol, recordColumn(r, "Long Period")]} />
        {r.evidence.regimes && <div className="table-wrap section-gap"><table className="comparison"><thead><tr><th>Regime</th><th>Profit</th><th>Profit Factor</th></tr></thead><tbody>{Object.entries(r.evidence.regimes).map(([k, v]) => <tr key={k}><td>{k.replace("_", " ")}</td><td className="mono">{v.profit ?? "—"}</td><td className="mono">{v.profit_factor ?? "—"}</td></tr>)}</tbody></table></div>}</div>)}
      {!group(["long_period"]).length && <p className="muted">Not tested.</p>}
    </Section>
    <Section title="Cross-broker validation" subtitle="Optional in the MVP">
      {group(["cross_broker"]).length ? <><ComparisonTable columns={[lastRealTick ? { title: "Real Tick", subtitle: "primary broker", metrics: lastRealTick.metrics } : baselineCol, ...group(["cross_broker"]).map(r => recordColumn(r, `Broker: ${r.label}`))]} />{group(["cross_broker"]).map(r => r.settings.execution_notes && <p key={r.id} className="context-note"><b>{r.label}:</b> {r.settings.execution_notes}</p>)}</> : <p className="muted">Optional · not tested.</p>}
    </Section>
    <Section title="Demo forward test" subtitle="Manually imported demo statistics">
      {group(["demo"]).length ? <ComparisonTable columns={[lastRealTick ? { title: "Real Tick", metrics: lastRealTick.metrics } : baselineCol, ...group(["demo"]).map(r => recordColumn(r, "Demo"))]} /> : <p className="muted">Not tested.</p>}<Notes records={group(["demo"])} />
    </Section>
    <Section title="Record a validation test" subtitle="Import results from MT5 for this Stable Set"><StageForm candidate={c} onSaved={refresh} /></Section>
    <Section title="Record a parameter robustness test"><RobustnessForm candidate={c} onSaved={refresh} /></Section>
  </>;
}
