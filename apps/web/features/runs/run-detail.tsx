"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Save } from "lucide-react";
import { api, jsonBody, number } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Heading, ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { Run } from "@/types";
export function RunDetail({ id }: { id: string }) {
  const [rev, setRev] = useState(0), [name, setName] = useState(""), [edit, setEdit] = useState(false), [message, setMessage] = useState("");
  const { data: run, error, loading } = useApi<Run>(`/optimization-runs/${id}`, rev);
  async function rename() { try { await api(`/optimization-runs/${id}`, { ...jsonBody({ name }), method: "PATCH" }); setEdit(false); setRev(r => r + 1); setMessage(""); } catch (e) { setMessage((e as Error).message); } }
  if (!run) return <ErrorBox message={error || (loading ? "" : "Run not found")} />;
  const entries = [["Expert Advisor", run.ea_name], ["Symbol", run.symbol], ["Timeframe", run.timeframe], ["Initial deposit", number(run.deposit)], ["Date from", run.date_from], ["Date to", run.date_to], ["Broker / server", run.broker], ["Leverage", run.leverage], ["Modelling method", run.modelling_method], ["Optimization algorithm", run.optimization_algorithm], ["Criterion", run.criterion], ["Results", run.result_count.toLocaleString()]];
  return <><Heading eyebrow={`OPTIMIZATION RUN / ${id}`} title={run.name} description={`${run.ea_name} · ${run.source_filename}`}><Button asChild><Link href={`/discovery?run=${id}`}>Discover candidates<ArrowRight size={15} /></Link></Button><Button variant="outline" asChild><Link href={`/explorer?run=${id}`}>Open Explorer<ArrowRight size={15} /></Link></Button><Button variant="outline" onClick={() => { setName(run.name); setEdit(true); }}>Rename</Button></Heading><ErrorBox message={message} />{edit && <div className="inline-edit"><input aria-label="Run name" value={name} maxLength={200} onChange={e => setName(e.target.value)} /><Button onClick={rename} disabled={!name.trim()}><Save size={15} />Save</Button><Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button></div>}<div className="panel"><div className="panel-head"><h2>Run metadata</h2><span className="badge">IMPORTED</span></div><div className="panel-body"><dl className="meta-grid">{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || "Not supplied"}</dd></div>)}</dl></div></div>{run.warnings.length > 0 && <div className="notice warning">{run.warnings.map((w,i) => <div key={i}>{w}</div>)}</div>}<div className="panel"><div className="panel-head"><h2>Reproducibility</h2></div><div className="panel-body"><p>Source file: <span className="mono">{run.source_filename}</span></p><p>Imported: {new Date(run.created_at).toLocaleString()}</p><p className="hash">SHA-256: {run.file_hash}</p><div className="section-gap"><h3>Detected EA inputs · {run.parameter_names.length}</h3><div className="parameter-chips section-gap">{run.parameter_names.map(p => <span className="parameter-chip" key={p}>{p}</span>)}</div></div></div></div></>;
}
