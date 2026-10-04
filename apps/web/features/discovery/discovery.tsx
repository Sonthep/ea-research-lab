"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookmarkPlus, ListFilter, Save, Upload, Download, Workflow } from "lucide-react";
import { api, jsonBody, number } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Heading, ErrorBox, Empty, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { downloadSetFile } from "@/lib/mt5";
import type { Run, Page, DiscoveryMethod, DiscoveryPolicy, DiscoveryPreview, DiscoveryBatch } from "@/types";

const defaults = { max_equity_dd: "10", min_profit_factor: "2", min_trades: "100", profit_above: "0", min_recovery: "", min_sharpe: "", min_expected_payoff: "", min_result: "" };
const requiredFields = [["max_equity_dd", "Equity DD ≤ (%)"], ["min_profit_factor", "Profit Factor ≥"], ["min_trades", "Trades ≥"], ["profit_above", "Profit >"]] as const;
const optionalFields = [["min_recovery", "Recovery Factor ≥"], ["min_sharpe", "Sharpe ≥"], ["min_expected_payoff", "Expected Payoff ≥"], ["min_result", "Criterion Result ≥"]] as const;
const settingsFields = [["optimization_algorithm", "Optimization algorithm"], ["criterion", "Optimization criterion"], ["modelling_method", "Modelling method"]] as const;

function RunContext({ run, recommended, onSaved, disabled }: { run: Run; recommended?: DiscoveryMethod; onSaved: () => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [values, setValues] = useState<DiscoveryMethod>({ optimization_algorithm: run.optimization_algorithm, criterion: run.criterion, modelling_method: run.modelling_method });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`/discovery/runs/${run.id}/settings`, { ...jsonBody(values), method: "PATCH" }); setEditing(false); onSaved(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="panel"><div className="panel-head"><h2>Discovery run</h2><span className="badge neutral">IMPORTED · NOT VALIDATED</span></div><div className="panel-body"><dl className="meta-grid">
    {[["Optimization Run", run.name], ["EA Name", run.ea_name], ["Symbol", run.symbol], ["Timeframe", run.timeframe], ["Date Range", `${run.date_from || "Not supplied"} → ${run.date_to || "Not supplied"}`], ["Optimization Results", run.result_count.toLocaleString()], ...settingsFields.map(([key, label]) => [label, run[key]])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not supplied"}</dd></div>)}
  </dl><div className="form-actions"><Link href={`/runs/${run.id}`} className="table-link">Run details →</Link><Button variant="ghost" size="sm" disabled={disabled} onClick={() => setEditing(!editing)} aria-expanded={editing}>Record MT5 settings</Button></div>
    {editing && <form className="section-gap" onSubmit={save}><p className="context-note">Record the settings actually used for this export. This does not run or change MT5.</p><fieldset disabled={busy || disabled} className="discovery-settings-grid">{settingsFields.map(([key, label]) => <label className="field" key={key}>{label}<input value={values[key] || ""} maxLength={120} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}</fieldset><div className="form-actions"><Button type="submit" disabled={busy || disabled}><Save size={14} />Save settings</Button>{recommended && <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => setValues(recommended)}>Fill recommended setup</Button>}</div><ErrorBox message={error} /></form>}
  </div></div>;
}

export function Discovery() {
  const params = useSearchParams();
  const [runId, setRunId] = useState(params.get("run") || ""), [runPage, setRunPage] = useState(1), [revision, setRevision] = useState(0);
  const [values, setValues] = useState(defaults), [topCount, setTopCount] = useState("20"), [preview, setPreview] = useState<DiscoveryPreview>(), [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const request = useRef(0);
  const runs = useApi<Page<Run>>(`/optimization-runs?page=${runPage}&page_size=25`);
  const run = useApi<Run>(runId ? `/optimization-runs/${runId}` : null, revision);
  const config = useApi<{ recommended: DiscoveryMethod }>("/discovery/configuration");
  const history = useApi<Page<DiscoveryBatch>>(runId ? `/discovery/batches?run_id=${runId}` : null, revision);
  useEffect(() => { request.current++; setPreview(undefined); setSelected(new Set()); setError(""); setMessage(""); setBusy(false); }, [runId]);
  function invalidate() { request.current++; setPreview(undefined); setSelected(new Set()); setMessage(""); setError(""); }
  function body() {
    const policy = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === "" ? null : Number(value)])) as unknown as DiscoveryPolicy;
    return { run_id: Number(runId), top_count: Number(topCount), policy };
  }
  async function review(e: React.FormEvent) {
    e.preventDefault(); const token = ++request.current; setBusy(true); setError(""); setMessage(""); setPreview(undefined);
    try { const data = await api<DiscoveryPreview>("/discovery/preview", jsonBody(body())); if (token !== request.current) return; setPreview(data); setSelected(new Set(data.items.map(r => r.id))); }
    catch (e) { if (token === request.current) setError((e as Error).message); } finally { if (token === request.current) setBusy(false); }
  }
  async function promote() {
    if (!preview) return; const token = ++request.current; setBusy(true); setError("");
    const savedBody = { run_id: preview.run.id, top_count: preview.top_count, policy: preview.policy };
    try {
      const result = await api<{ created: number; already_candidates: number }>("/discovery/promote", jsonBody({ ...savedBody, result_ids: Array.from(selected) }));
      if (token !== request.current) return;
      setMessage(`${result.created} candidates created. ${result.already_candidates} already shortlisted. Validation remains not tested.`);
      setSelected(new Set()); setRevision(r => r + 1);
      const refreshed = await api<DiscoveryPreview>("/discovery/preview", jsonBody(savedBody));
      if (token === request.current) setPreview(refreshed);
    } catch (e) { if (token === request.current) setError((e as Error).message); } finally { if (token === request.current) setBusy(false); }
  }
  function toggle(id: number) { setSelected(old => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  const selectedRun = run.data;
  return <>
    <Heading title="Candidate Discovery" description="Stage 1 · Find promising parameter sets, then shortlist 10–30 for validation."><Button variant="outline" asChild><Link href="/imports"><Upload size={15} />Import XML</Link></Button></Heading>
    <div className="discovery-setup"><div><span className="badge">MT5 DISCOVERY SETUP</span><h2>Search broadly. Shortlist carefully.</h2><p>Run optimization in MetaTrader 5, then import the results here.</p></div><dl>{settingsFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{config.data?.recommended[key] || "Loading…"}</dd></div>)}</dl></div>
    <ErrorBox message={error || runs.error || run.error || config.error || history.error} />
    {message && <div className="notice" role="status">{message} <Link href="/candidates" className="table-link">View candidates →</Link></div>}
    <div className="panel"><div className="panel-head"><h2>1. Choose an optimization run</h2></div><div className="panel-body"><label className="field">Optimization run<select disabled={busy} value={runId} onChange={e => setRunId(e.target.value)}><option value="">Select an imported run…</option>{selectedRun && !runs.data?.items.some(r => r.id === selectedRun.id) && <option value={selectedRun.id}>{selectedRun.name}</option>}{runs.data?.items.map(r => <option key={r.id} value={r.id}>{r.name} · {r.result_count.toLocaleString()} results</option>)}</select></label>{runs.data && runs.data.total > 25 && <Pagination page={runPage} pageSize={25} total={runs.data.total} onPage={setRunPage} />}{!runs.loading && runs.data?.total === 0 && <Empty title="Import your first discovery run" message="Export the optimization table from MT5 as XML." href="/imports" />}</div></div>
    {run.loading && runId && <div className="loading">Loading discovery run…</div>}
    {selectedRun && <>
      <RunContext key={`${selectedRun.id}-${revision}`} run={selectedRun} recommended={config.data?.recommended} disabled={busy} onSaved={() => { invalidate(); setRevision(r => r + 1); }} />
      <div className="panel"><div className="panel-head"><h2>2. Filter and rank candidates</h2><span className="badge neutral">ALL CONDITIONS · AND</span></div><form className="panel-body" onSubmit={review}><fieldset disabled={busy} className="discovery-fields">{requiredFields.map(([key, label]) => <label className="field" key={key}>{label}<input required type="number" step={key === "min_trades" ? "1" : "any"} min={key === "profit_above" ? undefined : "0"} max={key === "max_equity_dd" ? "100" : undefined} value={values[key]} onChange={e => { invalidate(); setValues({ ...values, [key]: e.target.value }); }} /></label>)}</fieldset>
      <details className="disclosure discovery-optional"><summary>Optional metric filters</summary><fieldset disabled={busy} className="discovery-fields">{optionalFields.map(([key, label]) => <label className="field" key={key}>{label}<input type="number" step="any" min={key === "min_recovery" ? "0" : undefined} placeholder="No minimum" value={values[key]} onChange={e => { invalidate(); setValues({ ...values, [key]: e.target.value }); }} /></label>)}</fieldset></details>
      <div className="discovery-ranking"><b>Ranking order</b><p>Profit Factor ↓ → Recovery ↓ → Equity DD ↑ → Trades ↓ → Criterion Result ↓ → Profit ↓</p><small>Higher PF first; subsequent metrics break ties. Missing ranking metrics sort last. Each complete parameter configuration appears once. Profit alone does not determine the shortlist.</small></div>
      <div className="form-actions"><label className="field">Top candidates<input aria-label="Top candidates" type="number" min="10" max="30" step="1" required value={topCount} disabled={busy} onChange={e => { invalidate(); setTopCount(e.target.value); }} /></label><Button type="submit" disabled={busy || run.loading}><ListFilter size={15} />{busy ? "Working…" : "Preview top candidates"}</Button><Button variant="ghost" type="button" disabled={busy} onClick={() => { invalidate(); setValues(defaults); setTopCount("20"); }}>Reset defaults</Button></div></form></div>
    </>}
    {preview && <div className="panel"><div className="panel-head"><h2>3. Select your shortlist</h2><span className="badge neutral">VALIDATION NOT TESTED</span></div>
      <div className="discovery-funnel" aria-label="Discovery funnel"><div><b>{preview.total_results.toLocaleString()}</b><small>Optimization results</small></div><ArrowRight size={18} /><div><b>{preview.qualifying_results.toLocaleString()}</b><small>Pass all filters</small></div><ArrowRight size={18} /><div><b>{preview.qualifying_sets.toLocaleString()}</b><small>Unique configurations</small></div><ArrowRight size={18} /><div><b>{preview.items.length}</b><small>Top candidates</small></div></div>
      {preview.settings_warnings.length > 0 && <div className="panel-body discovery-warnings"><div className="notice warning"><b>Check discovery context</b>{preview.settings_warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
      {preview.items.length > 0 && preview.items.length < preview.top_count && <p className="shortlist-note">Only {preview.items.length} unique configurations pass these filters. The shortlist is not padded with weaker results.</p>}
      {preview.items.length === 0 ? <Empty title="No configurations pass all filters" message="Review the run or adjust the thresholds before selecting candidates." href={`/explorer?run=${runId}`} /> : <>
        <div className="selection-bar">
          <div className="selection-info">
            <span><b>{selected.size}</b> of {preview.items.length} selected</span>
            <div className="quick-select-pills" style={{ display: "inline-flex", gap: 6, marginLeft: 12 }}>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelected(new Set(preview.items.slice(0, 3).map(r => r.id)))}>
                Top 3
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelected(new Set(preview.items.slice(0, 5).map(r => r.id)))}>
                Top 5
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelected(new Set(preview.items.map(r => r.id)))}>
                Select All
              </Button>
            </div>
          </div>
          <div className="heading-actions">
            <Button size="sm" disabled={busy || selected.size === 0} onClick={promote}>
              <BookmarkPlus size={14} /> Promote Selected ({selected.size})
            </Button>
          </div>
        </div>
        <div className="table-wrap"><table className="discovery-table"><thead><tr><th>Select</th><th>Rank</th><th>Stable Set ID</th><th>PF</th><th>Recovery</th><th>Equity DD %</th><th>Trades</th><th>Profit</th><th>Criterion Result</th><th>Actions</th></tr></thead><tbody>{preview.items.map(row => <tr key={row.id}><td><input type="checkbox" aria-label={`Select ${row.stable_set_id}`} disabled={busy} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td className="mono">{row.discovery_rank}</td><td><Link className="table-link mono" href={`/sets/${row.parameter_set_id}`}>{row.stable_set_id}</Link><small>MT5 Pass {row.mt5_pass || "—"}</small></td><td className="mono font-bold cyan">{number(row.profit_factor)}</td><td className="mono">{number(row.recovery_factor)}</td><td className="mono">{number(row.equity_dd)}</td><td className="mono">{number(row.trades, 0)}</td><td className="mono green">{number(row.profit)}</td><td className="mono">{number(row.result)}</td><td><div style={{ display: "flex", gap: 6, alignItems: "center" }}><Button size="sm" variant="outline" title="Download MT5 .set file" onClick={() => downloadSetFile(row.parameters, `${row.stable_set_id}_${selectedRun?.ea_name}`)}><Download size={13} /> .set</Button>{row.candidate_id && <Button size="sm" variant="outline" asChild><Link href={`/workflow?candidate=${row.candidate_id}&step=3`}><Workflow size={13} /> Workflow</Link></Button>}</div></td></tr>)}</tbody></table></div>
      </>}
    </div>}
    {history.data && history.data.total > 0 && <div className="panel"><div className="panel-head"><h2>Saved discovery selections</h2><Link className="table-link" href="/candidates">Candidate sets<ArrowRight size={15} /></Link></div><div className="panel-body">{history.data.items.map(batch => <div className="discovery-history" key={batch.id}><div><b>Selection #{batch.id} · {batch.selected_results.length} new candidates</b><small>{new Date(batch.created_at).toLocaleString()} · {batch.run_settings.modelling_method || "Modelling not supplied"}</small><small>DD ≤ {batch.policy.max_equity_dd}% · PF ≥ {batch.policy.min_profit_factor} · Trades ≥ {batch.policy.min_trades} · Profit &gt; {batch.policy.profit_above}</small></div><span className="badge neutral">NOT VALIDATED</span></div>)}{history.data.total > history.data.items.length && <small>Showing the latest {history.data.items.length} of {history.data.total} selections.</small>}</div></div>}
    <div className="notice">Discovery finds promising parameter sets. The next validation step uses Every tick based on real ticks with optimization disabled. No validation stage is marked passed by selecting a candidate.</div>
  </>;
}
