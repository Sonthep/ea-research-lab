import type { Candidate } from "@/types";

export function DiscoveryEvidence({ candidate }: { candidate: Candidate }) {
  const method = candidate.discovery_method, evidence = candidate.discovery_evidence;
  return <div className="candidate-discovery-context">
    <small>Discovery method</small><p>{method.optimization_algorithm || "Algorithm not supplied"} / {method.criterion || "Criterion not supplied"} / {method.modelling_method || "Modelling not supplied"}</p>
    {evidence && <details className="disclosure"><summary>Discovery selection #{evidence.batch_id} · Rank {evidence.rank}</summary><p>DD ≤ {evidence.policy.max_equity_dd}% · PF ≥ {evidence.policy.min_profit_factor} · Trades ≥ {evidence.policy.min_trades} · Profit &gt; {evidence.policy.profit_above}</p>{([["Recovery", evidence.policy.min_recovery], ["Sharpe", evidence.policy.min_sharpe], ["Expected Payoff", evidence.policy.min_expected_payoff], ["Criterion Result", evidence.policy.min_result]] as const).filter(([, value]) => value !== null).map(([label, value]) => <small key={label}>{label} ≥ {value}</small>)}<small>{evidence.ranking.join(" → ")}</small></details>}
    <small className="section-gap">Validation method</small><p>{candidate.validation_method} · Optimization disabled</p><span className="badge neutral">{candidate.validation_status.replaceAll("_", " ")}</span>
  </div>;
}
