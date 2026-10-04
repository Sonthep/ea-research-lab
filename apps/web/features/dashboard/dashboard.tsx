"use client";
import Link from "next/link";
import { Upload, ArrowRight, Table2, Bookmark, Workflow, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Heading, ErrorBox, Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { Candidate, FunnelStep, Page, Run, StageCount } from "@/types";
import { OverallBadge, PipelineView } from "@/features/candidates/pipeline";
interface Stats { results: number; runs: number; profitable: number; low_dd: number; high_pf: number; candidates: number; initial_filter_results: number; initial_filter_sets: number; discovery_batches: number; funnel: FunnelStep[]; stage_counts: StageCount[] }
export function Dashboard() {
  const stats = useApi<Stats>("/dashboard"), runs = useApi<Page<Run>>("/optimization-runs?page_size=5"), latest = useApi<Page<Candidate>>("/candidates?page_size=1");
  const s = stats.data;
  const cards = [
    { label: "Optimization results", value: s?.results, detail: `${s?.runs ?? 0} imported runs` },
    { label: "Profitable results", value: s?.profitable, detail: "Net profit above zero" },
    { label: "Drawdown under 10%", value: s?.low_dd, detail: `${s?.high_pf?.toLocaleString() ?? "—"} results with PF ≥ 2` },
    { label: "Candidate sets", value: s?.candidates, detail: "Your research shortlist" },
  ];
  return (
    <>
      <Heading title="Dashboard" description="Your optimization research and quantitative pipeline.">
        <Button variant="outline" asChild><Link href="/workflow"><Workflow size={16} />Quant Workflow (11 Steps)</Link></Button>
        <Button asChild><Link href="/imports"><Upload size={16} />Import XML</Link></Button>
      </Heading>

      {/* Featured 11-Step Flow State Hero Banner */}
      <div className="panel" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)", borderColor: "#a7f3d0" }}>
        <div className="panel-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <span className="badge" style={{ marginBottom: 8 }}><Sparkles size={12} /> GUIDED FLOW STATE</span>
            <h2 style={{ fontSize: 18, color: "#0f172a" }}>11-Step Quantitative Validation Workflow</h2>
            <p style={{ marginTop: 4, maxWidth: 640, color: "#475569" }}>
              ระบบนำทางการทำงานเชื่อมต่อ <b>MetaTrader 5</b> และ <b>Research Lab</b>: จาก Fast Genetic → คัด 3–5 ตัว → Real Tick → เทียบ OHLC → ขยายเวลา → Forward → Cluster → หรี่ Range → Slow Complete → Stress → Demo
            </p>
          </div>
          <Button asChild size="default" style={{ background: "#059669", color: "#ffffff", fontWeight: 700 }}>
            <Link href="/workflow">
              <Workflow size={16} /> เปิดใช้งาน Flow State Workbench →
            </Link>
          </Button>
        </div>
      </div>

      <ErrorBox message={stats.error || runs.error} />
      <div className="stats">{cards.map(card => <div className="stat" key={card.label}><div className="stat-label">{card.label}</div><div className="stat-value">{card.value?.toLocaleString() ?? "—"}</div><small>{card.detail}</small></div>)}</div>
      <div className="panel"><div className="panel-head"><h2>Validation funnel</h2><Link href="/discovery">Start discovery<ArrowRight size={15} /></Link></div><ol className="funnel" aria-label="Validation funnel">{(s?.funnel ?? []).map((step, i, all) => <li key={step.key} data-step={step.key}><div className="funnel-bar" style={{ width: `${Math.max(4, all[0].count ? (step.count / all[0].count) * 100 : 4)}%` }} /><b className="mono">{step.count.toLocaleString()}</b><span>{step.label}</span></li>)}</ol><p className="shortlist-note">Each count is cumulative and computed from stored data. Initial filter: DD ≤ 10% · PF ≥ 2 · Trades ≥ 100 · Profit &gt; 0. Optimization results and filters are discovery evidence, not validation.</p></div>
      <div className="two-col dashboard-grid">
        <div className="panel"><div className="panel-head"><h2>Validation pipeline</h2><Link href="/candidates">All candidates<ArrowRight size={15} /></Link></div><div className="panel-body">
          {latest.data?.items[0] ? <><p className="context-note">Latest candidate: <Link className="table-link mono" href={`/candidates/${latest.data.items[0].id}`}>{latest.data.items[0].baseline.stable_set_id}</Link></p><PipelineView stages={latest.data.items[0].pipeline} setId={latest.data.items[0].baseline.stable_set_id} /><div className="overall-line">Overall Status: <OverallBadge status={latest.data.items[0].overall_status} /></div></> : <Empty title="No candidate sets yet" message="Import an MT5 optimization, then promote candidates in Candidate Discovery to start the validation pipeline." href="/discovery" />}
        </div></div>
        <div className="panel"><div className="panel-head"><h2>Pipeline status of all candidates</h2></div><div className="table-wrap"><table><thead><tr><th>Stage</th><th>Passed</th><th>Running</th><th>Warning</th><th>Failed</th><th>Not tested</th></tr></thead><tbody>{(s?.stage_counts ?? []).map(r => <tr key={r.key}><td>{r.label}{r.required ? "" : " (optional)"}</td><td className="mono green">{r.PASSED}</td><td className="mono">{r.RUNNING}</td><td className="mono amber">{r.WARNING}</td><td className="mono">{r.FAILED}</td><td className="mono muted">{r.NOT_TESTED}</td></tr>)}</tbody></table></div></div>
      </div>
      <div className="two-col dashboard-grid">
        <div className="panel">
          <div className="panel-head"><h2>Recent runs</h2><Link href="/runs">View all<ArrowRight size={15} /></Link></div>
          {runs.loading ? <div className="loading">Loading runs…</div> : !runs.data?.items.length ? <Empty title="Start your research library" message="Import an MT5 optimization XML to explore its results." /> :
            <div className="table-wrap"><table className="recent-runs">
              <thead><tr><th>Optimization run</th><th>Market</th><th>Results</th><th /></tr></thead>
              <tbody>{runs.data.items.map(r => <tr key={r.id}>
                <td><Link className="table-link" href={`/runs/${r.id}`}>{r.name}</Link><small>{r.ea_name}</small></td>
                <td>{r.symbol || "Unknown"}<small>{r.timeframe || "—"}</small></td>
                <td className="mono">{r.result_count.toLocaleString()}</td>
                <td><Link href={`/explorer?run=${r.id}`} className="row-action" aria-label={`Explore ${r.name}`}><ArrowRight size={16} /></Link></td>
              </tr>)}</tbody>
            </table></div>}
        </div>
        <div className="panel quick-actions">
          <div className="panel-head"><h2>Continue your research</h2></div>
          <div className="panel-body">
            <Link className="quick-action" href="/imports"><span className="quick-icon"><Upload size={18} /></span><span><b>Import results</b><small>Add an MT5 optimization export</small></span><ArrowRight size={16} /></Link>
            <Link className="quick-action" href="/explorer"><span className="quick-icon"><Table2 size={18} /></span><span><b>Open Explorer</b><small>Filter results and inspect inputs</small></span><ArrowRight size={16} /></Link>
            <Link className="quick-action" href="/candidates"><span className="quick-icon"><Bookmark size={18} /></span><span><b>Review candidates</b><small>Organize your selected sets</small></span><ArrowRight size={16} /></Link>
          </div>
        </div>
      </div>
    </>
  );
}
