"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Upload } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Heading, ErrorBox, Empty, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { number } from "@/lib/api";
import type { Run, Page } from "@/types";
export function RunList() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<Page<Run>>(`/optimization-runs?page=${page}`);
  return <><Heading eyebrow="RESEARCH LIBRARY" title="Optimization Runs" description="Keep every optimization reproducible, from source file to parameter set."><Button asChild><Link href="/imports"><Upload size={15} />Import XML</Link></Button></Heading><ErrorBox message={error} /><div className="panel"><div className="panel-head"><h2>All optimization runs</h2><span className="badge neutral">{data?.total ?? 0} RUNS</span></div>{loading ? <div className="loading">Loading runs…</div> : !data?.items.length ? <Empty title="No optimization runs yet" message="Import an MT5 optimization XML, or load the sample data using the seed command." /> : <><div className="table-wrap"><table><thead><tr><th>Run / Expert Advisor</th><th>Market</th><th>Test period</th><th>Deposit</th><th>Results</th><th>Imported</th><th /></tr></thead><tbody>{data.items.map(run => <tr key={run.id}><td><Link className="table-link" href={`/runs/${run.id}`}>{run.name}</Link><small>{run.ea_name}</small></td><td>{run.symbol || "Unknown"}<small>{run.timeframe || "Unknown timeframe"}</small></td><td>{run.date_from || "—"}<small>to {run.date_to || "—"}</small></td><td className="mono">{number(run.deposit)}</td><td className="mono">{run.result_count.toLocaleString()}</td><td>{new Date(run.created_at).toLocaleDateString()}</td><td><Link href={`/explorer?run=${run.id}`} aria-label={`Explore ${run.name}`}><ArrowUpRight size={16} className="blue" /></Link></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={25} total={data.total} onPage={setPage} /></>}</div></>;
}
