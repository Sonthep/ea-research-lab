"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { ValidationRules } from "@/types";

const NUMBERS: [keyof ValidationRules, string][] = [["profit_degradation_pct", "Profit degradation warning (%)"], ["drawdown_multiple", "Drawdown warning (x baseline)"], ["min_profit_factor", "Minimum Profit Factor"], ["trade_change_pct", "Trade count change warning (%)"], ["fail_warning_count", "Warnings needed to mark FAILED"], ["robustness_min_profit_factor", "Robustness: good-neighbour PF"], ["plateau_min_good_ratio", "Plateau: share of good neighbours"]];

export function ValidationRulesPanel() {
  const { data, error } = useApi<{ rules: ValidationRules; stages: Record<string, string> }>("/validation/config");
  const [rules, setRules] = useState<ValidationRules>(), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  useEffect(() => { if (data) setRules(data.rules); }, [data]);
  if (!rules || !data) return <ErrorBox message={error} />;
  const toggle = (k: string) => setRules({ ...rules, required_stages: rules.required_stages.includes(k) ? rules.required_stages.filter(s => s !== k) : [...rules.required_stages, k] });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setErr("");
    try { await api("/validation/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rules) }); setMsg("Validation rules saved."); }
    catch (x) { setErr((x as Error).message); }
  }
  const stages = ["real_tick", "latency", "random_delay", "oos", "forward", "robustness", "long_period", "cross_broker", "demo"];
  return <form className="panel" onSubmit={save}><div className="panel-head"><h2>Validation rules</h2></div><div className="panel-body">
    <p className="context-note">Thresholds produce warnings and evidence; a single crossed threshold never fails a test on its own. LIVE CANDIDATE is only shown when every required stage has passed.</p>
    <div className="form-grid">{NUMBERS.map(([k, label]) => <label className="field" key={k}>{label}<input type="number" step="any" value={rules[k] as number} onChange={e => setRules({ ...rules, [k]: Number(e.target.value) })} /></label>)}</div>
    <h3 className="section-gap">Stages required for LIVE CANDIDATE</h3>
    <div className="checks">{stages.map(k => <label key={k}><input type="checkbox" checked={rules.required_stages.includes(k)} onChange={() => toggle(k)} /> {data.stages[k]}</label>)}</div>
    <label className="checks section-gap"><span><input type="checkbox" checked={rules.warning_counts_as_pass} onChange={e => setRules({ ...rules, warning_counts_as_pass: e.target.checked })} /> Stages with warnings count as complete</span></label>
    <ErrorBox message={err} />{msg && <p className="success" role="status">{msg}</p>}<div className="form-actions"><Button type="submit">Save rules</Button></div>
  </div></form>;
}
