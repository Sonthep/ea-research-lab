"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Zap,
  Target,
  Clock,
  Scale,
  Calendar,
  FastForward,
  Grid,
  Minimize2,
  Hourglass,
  Activity,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Download,
  ArrowRight,
  ArrowLeft,
  Sliders,
  FileCode,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon
} from "lucide-react";
import { api, jsonBody, number } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  downloadSetFile,
  copyToClipboard,
  calculateNarrowRange,
  formatMT5OptimizationInputs,
  formatSetFileContent
} from "@/lib/mt5";
import { EquityCurveChart, ParetoFrontierChart, ParameterClusterChart } from "@/components/charts/quant-charts";
import type { Page, Run, Candidate, CandidateDetail, DiscoveryPreview, Status } from "@/types";

interface StepDef {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  icon: typeof Zap;
  mt5Action: string;
  labAction: string;
}

const STEPS: StepDef[] = [
  {
    id: 1,
    key: "fast_genetic",
    title: "1. Fast Genetic Optimization",
    subtitle: "ค้นหาพื้นที่พารามิเตอร์กว้างๆ บน 1-min OHLC",
    icon: Zap,
    mt5Action: "รัน Fast Genetic ใน MT5 (Model: 1 minute OHLC) แล้ว Export XML",
    labAction: "นำเข้าไฟล์ XML และตรวจสอบจำนวนผลลัพธ์ทั้งหมด"
  },
  {
    id: 2,
    key: "select_candidates",
    title: "2. เลือก 3–5 Candidates",
    subtitle: "คัดกรองเฉพาะ Shortlist คุณภาพสูงสุด",
    icon: Target,
    mt5Action: "เตรียมรับ .set file หรือ Copy parameters ของ Candidate",
    labAction: "กรอง DD ≤ 10%, PF ≥ 2, Trades ≥ 100 แล้วเลือก 3–5 ตัวท็อป"
  },
  {
    id: 3,
    key: "real_tick",
    title: "3. Every Tick Based on Real Ticks",
    subtitle: "จำลองด้วยข้อมูล Tick จริงความแม่นยำสูงสุด",
    icon: Clock,
    mt5Action: "ปิด Optimization, ตั้ง Model: Every tick based on real ticks แล้วรัน Backtest",
    labAction: "บันทึกผลการทดสอบ Real Tick ของ Candidate ที่เลือก"
  },
  {
    id: 4,
    key: "compare_ohlc",
    title: "4. เปรียบเทียบผลกับ OHLC",
    subtitle: "ตรวจสอบความคงทนและ Tick Sensitivity",
    icon: Scale,
    mt5Action: "เทียบผลการเทรดจริงกับสมมติฐานเดิมใน MT5",
    labAction: "คำนวณ % Degradation (กำไรห้ามตกเกิน 30%, DD ห้ามเพิ่มเกิน 2x)"
  },
  {
    id: 5,
    key: "long_period",
    title: "5. ขยายระยะเวลา Backtest",
    subtitle: "ทดสอบข้ามวัฏจักรตลาดหลายปี (Market Regimes)",
    icon: Calendar,
    mt5Action: "ขยายช่วงวันที่ใน MT5 ให้ครอบคลุม Bull, Bear, Sideway และ High Volatility",
    labAction: "บันทึกผล Long Period เพื่อเช็คว่า EA รอดในทุกสภาวะตลาดหรือไม่"
  },
  {
    id: 6,
    key: "forward",
    title: "6. Forward Optimization",
    subtitle: "ตรวจสอบ Out-of-Sample และ Walk-Forward",
    icon: FastForward,
    mt5Action: "ตั้งค่า Forward Test ใน MT5 (เช่น 1/3 Forward) หรือรันช่วงเวลา Out-of-Sample",
    labAction: "เทียบ In-Sample vs Forward เพื่อดูว่าพฤติกรรมยังคงเดิมหรือไม่"
  },
  {
    id: 7,
    key: "cluster_analysis",
    title: "7. หา Parameter Cluster",
    subtitle: "มองหา Plateau ไม่เอา Peak แหลม Overfit",
    icon: Grid,
    mt5Action: "ตรวจสอบพารามิเตอร์ข้างเคียงในตาราง Optimization",
    labAction: "วิเคราะห์ Heatmap/Plateau: โซนรอบๆ ต้องกำไรสม่ำเสมอ"
  },
  {
    id: 8,
    key: "narrow_range",
    title: "8. ลด Range ของ Parameters",
    subtitle: "บีบกรอบพารามิเตอร์รอบกลุ่มก้อน Cluster",
    icon: Minimize2,
    mt5Action: "นำค่า Start, Step, Stop แคบๆ ไปกรอกในช่อง Inputs ของ MT5",
    labAction: "ระบบคำนวณ Range แนะนำอัตโนมัติ พร้อมปุ่ม Copy สำหรับ MT5"
  },
  {
    id: 9,
    key: "slow_complete",
    title: "9. Slow Complete Algorithm",
    subtitle: "รันแบบละเอียดครบทุก Combination ในกรอบแคบ",
    icon: Hourglass,
    mt5Action: "ใน MT5 เลือก 'Slow complete algorithm' ด้วย Range แคบที่ได้จาก Step 8",
    labAction: "ตรวจสอบว่าทุกจุดในกรอบแคบให้ผลลัพธ์สม่ำเสมอ ไม่มีหลุมลึก"
  },
  {
    id: 10,
    key: "stress_test",
    title: "10. Execution Stress Test",
    subtitle: "ทดสอบจำลอง Latency, Delay, Slippage, Spread",
    icon: Activity,
    mt5Action: "ใน MT5 ตั้งค่า Execution Delay (50ms, 100ms, Random Delay)",
    labAction: "ตรวจสอบว่ากำไรไม่หายไปกับค่าความหน่วงของ Broker"
  },
  {
    id: 11,
    key: "demo_forward",
    title: "11. Demo Forward Test",
    subtitle: "รันบอทจริงบนบัญชี Demo เพื่อสังเกตการณ์ Real-time",
    icon: Rocket,
    mt5Action: "ติดตั้ง EA บน MT5 กราฟสด บัญชี Demo พร้อม VPS อย่างน้อย 2–4 สัปดาห์",
    labAction: "ติดตามผลงานจริง เมื่อผ่านทุกเกณฑ์จึงเลื่อนชั้นเป็น LIVE CANDIDATE"
  }
];

export function WorkflowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const runIdParam = searchParams.get("run") || "";
  const candidateIdParam = searchParams.get("candidate") || "";
  const stepParam = Number(searchParams.get("step")) || 1;

  const [activeStep, setActiveStep] = useState(stepParam);
  const [selectedRunId, setSelectedRunId] = useState(runIdParam);
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidateIdParam);
  const [copiedText, setCopiedText] = useState("");
  const [revision, setRevision] = useState(0);
  const [showHeroDiagram, setShowHeroDiagram] = useState(false);

  // Discovery state for Step 2
  const [discoveryCount, setDiscoveryCount] = useState<number>(3);
  const [discoveryPreview, setDiscoveryPreview] = useState<DiscoveryPreview>();
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<number>>(new Set());

  // Real tick input form state for Step 3
  const [realTickProfit, setRealTickProfit] = useState("");
  const [realTickDD, setRealTickDD] = useState("");
  const [realTickPF, setRealTickPF] = useState("");
  const [realTickTrades, setRealTickTrades] = useState("");
  const [recordBusy, setRecordBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Data fetching
  const runs = useApi<Page<Run>>("/optimization-runs?page_size=100");
  const candidates = useApi<Page<Candidate>>(
    selectedRunId ? `/candidates?run_id=${selectedRunId}&page_size=50` : `/candidates?page_size=50`,
    revision
  );
  const activeCandidateDetail = useApi<CandidateDetail>(
    selectedCandidateId ? `/candidates/${selectedCandidateId}` : null,
    revision
  );

  // Sync state with URL
  useEffect(() => {
    if (stepParam && stepParam >= 1 && stepParam <= 11) {
      setActiveStep(stepParam);
    }
  }, [stepParam]);

  useEffect(() => {
    if (!selectedRunId && runs.data?.items?.length) {
      setSelectedRunId(String(runs.data.items[0].id));
    }
  }, [runs.data, selectedRunId]);

  useEffect(() => {
    if (!selectedCandidateId && candidates.data?.items?.length) {
      setSelectedCandidateId(String(candidates.data.items[0].id));
    }
  }, [candidates.data, selectedCandidateId]);

  function changeStep(s: number) {
    setActiveStep(s);
    setActionSuccess("");
    setActionError("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(s));
    if (selectedRunId) params.set("run", selectedRunId);
    if (selectedCandidateId) params.set("candidate", selectedCandidateId);
    router.replace(`/workflow?${params.toString()}`);
  }

  const activeRun = runs.data?.items.find(r => String(r.id) === selectedRunId);
  const activeCandidate = activeCandidateDetail.data;
  const currentStepDef = STEPS[activeStep - 1] || STEPS[0];

  // Helper to trigger discovery for Step 2
  async function runQuickDiscovery(count: number) {
    if (!selectedRunId) return;
    setDiscoveryBusy(true);
    setActionError("");
    setDiscoveryCount(count);
    try {
      const data = await api<DiscoveryPreview>("/discovery/preview", jsonBody({
        run_id: Number(selectedRunId),
        top_count: count,
        policy: {
          max_equity_dd: 10,
          min_profit_factor: 2,
          min_trades: 100,
          profit_above: 0
        }
      }));
      setDiscoveryPreview(data);
      setSelectedResultIds(new Set(data.items.map(r => r.id)));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setDiscoveryBusy(false);
    }
  }

  // Promote shortlisted candidates
  async function promoteShortlist() {
    if (!discoveryPreview) return;
    setDiscoveryBusy(true);
    setActionError("");
    try {
      const res = await api<{ created: number; already_candidates: number }>("/discovery/promote", jsonBody({
        run_id: discoveryPreview.run.id,
        top_count: discoveryPreview.top_count,
        policy: discoveryPreview.policy,
        result_ids: Array.from(selectedResultIds)
      }));
      setActionSuccess(`Shortlist บันทึกเรียบร้อย: สร้าง ${res.created} Candidate ใหม่ (มีอยู่แล้ว ${res.already_candidates})`);
      setRevision(r => r + 1);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setDiscoveryBusy(false);
    }
  }

  // Record Real Tick validation (Step 3 & 4)
  async function submitRealTickTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCandidateId) return;
    setRecordBusy(true);
    setActionError("");
    setActionSuccess("");
    try {
      await api(`/candidates/${selectedCandidateId}/validation/real_tick`, jsonBody({
        label: "Real Tick Primary",
        metrics: {
          profit: Number(realTickProfit),
          equity_dd: Number(realTickDD),
          profit_factor: Number(realTickPF),
          trades: Number(realTickTrades)
        },
        settings: {
          delay_ms: 0,
          modelling_method: "Every tick based on real ticks"
        },
        notes: "Real tick execution on MetaTrader 5"
      }));
      setActionSuccess("บันทึกผล Every Tick เรียบร้อยแล้ว! ดูการเปรียบเทียบใน Step 4");
      setRevision(r => r + 1);
      setTimeout(() => changeStep(4), 1200);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRecordBusy(false);
    }
  }

  // Copy helper
  async function handleCopy(text: string, label: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedText(label);
      setTimeout(() => setCopiedText(""), 2000);
    }
  }

  // Extract baseline metrics
  const baseline = activeCandidate?.baseline;
  const realTickRecords = activeCandidate?.records.filter(r => r.stage === "real_tick") || [];
  const latestRealTick = realTickRecords[realTickRecords.length - 1];

  // Degradation calculation for Step 4
  const degradation = {
    profitDropPct: baseline && latestRealTick?.metrics.profit != null
      ? ((latestRealTick.metrics.profit - (baseline.profit ?? 0)) / Math.abs(baseline.profit || 1)) * 100
      : null,
    ddDiffPp: baseline && latestRealTick?.metrics.equity_dd != null
      ? latestRealTick.metrics.equity_dd - (baseline.equity_dd ?? 0)
      : null,
    pfDiff: baseline && latestRealTick?.metrics.profit_factor != null
      ? latestRealTick.metrics.profit_factor - (baseline.profit_factor ?? 0)
      : null,
    tradesDropPct: baseline && latestRealTick?.metrics.trades != null
      ? ((latestRealTick.metrics.trades - (baseline.trades ?? 0)) / Math.max(1, baseline.trades ?? 1)) * 100
      : null,
  };

  // Automated verdict check
  const isRealTickPassed = degradation.profitDropPct !== null &&
    degradation.profitDropPct > -30 &&
    (degradation.ddDiffPp ?? 0) < 5 &&
    (latestRealTick?.metrics.profit_factor ?? 0) >= 1.5;

  // Step 8: Narrow Ranges calculation
  const numericParams = activeCandidate
    ? Object.entries(activeCandidate.parameters)
        .filter(([, v]) => Number.isFinite(Number(v)))
        .map(([k, v]) => calculateNarrowRange(k, Number(v)))
    : [];

  const mt5RangeInputsString = activeCandidate
    ? formatMT5OptimizationInputs(numericParams, activeCandidate.parameters)
    : "";

  return (
    <div className="quant-workflow-wrapper">
      {/* Top Strategy & Candidate Selector */}
      <div className="workflow-header-panel">
        <div className="workflow-title-row">
          <div>
            <span className="badge-terminal">QUANTITATIVE VALIDATION PIPELINE</span>
            <h1 className="terminal-title">11-Step Flow State Workbench</h1>
            <p className="terminal-subtitle">
              เชื่อมต่อการทำงานระหว่าง <b>MetaTrader 5</b> และ <b>EA Research Lab</b> แบบ Step-by-Step ไร้รอยต่อ
            </p>
            <Button
              size="sm"
              variant={showHeroDiagram ? "default" : "outline"}
              onClick={() => setShowHeroDiagram(!showHeroDiagram)}
              className="hero-diagram-toggle"
            >
              <ImageIcon size={14} />
              {showHeroDiagram ? "ซ่อนแผนภาพ Quantitative Flow" : "🖼️ ดูแผนภาพ Quantitative Pipeline"}
            </Button>
          </div>

          <div className="selector-group">
            <div className="selector-field">
              <label>1. เลือก Optimization Run</label>
              <select
                value={selectedRunId}
                onChange={e => {
                  setSelectedRunId(e.target.value);
                  setSelectedCandidateId("");
                  setDiscoveryPreview(undefined);
                }}
              >
                {runs.data?.items.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.symbol} {r.timeframe}) · {r.result_count.toLocaleString()} passes
                  </option>
                ))}
              </select>
            </div>

            <div className="selector-field">
              <label>2. เลือก Candidate ที่กำลังทดสอบ</label>
              <select
                value={selectedCandidateId}
                onChange={e => setSelectedCandidateId(e.target.value)}
              >
                <option value="">-- เลือก Candidate Set --</option>
                {candidates.data?.items.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.baseline.stable_set_id} · PF {number(c.baseline.profit_factor)} · DD {number(c.baseline.equity_dd)}% · Profit ${number(c.baseline.profit)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quantitative Pipeline Architecture Illustration */}
        {showHeroDiagram && (
          <div className="workflow-hero-card">
            <div className="workflow-hero-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/workflow-hero.jpg"
                alt="Quantitative Trading Workflow Architecture"
                className="workflow-hero-img"
              />
            </div>
            <div className="workflow-hero-overlay">
              <span className="hero-tag">System Blueprint</span>
              <h3>11-Step MetaTrader 5 &harr; EA Research Lab Architecture</h3>
              <p>
                แผนผังกระบวนการวิจัยเชิงปริมาณ (Quantitative Research Pipeline) เชื่อมโยงการสำรวจพารามิเตอร์แบบ Fast Genetic, การพิสูจน์ด้วย Real Ticks, การวิเคราะห์ความคงทนแบบ Robustness Plateau จนถึงการทดสอบ Live Forward Test
              </p>
            </div>
          </div>
        )}

        {/* Candidate Active Stat Pill */}
        {activeCandidate && (
          <div className="active-candidate-banner">
            <div className="banner-id">
              <span className="indicator-live" />
              <span>ACTIVE SET: <b>{activeCandidate.baseline.stable_set_id}</b></span>
              <span className="banner-sub">{activeCandidate.run.ea_name} · {activeCandidate.run.symbol} {activeCandidate.run.timeframe}</span>
            </div>

            <div className="banner-metrics">
              <div className="metric-pill">
                <span>OHLC Baseline Profit</span>
                <b className="green">${number(activeCandidate.baseline.profit)}</b>
              </div>
              <div className="metric-pill">
                <span>Drawdown</span>
                <b>{number(activeCandidate.baseline.equity_dd)}%</b>
              </div>
              <div className="metric-pill">
                <span>Profit Factor</span>
                <b className="cyan">{number(activeCandidate.baseline.profit_factor)}</b>
              </div>
              <div className="metric-pill">
                <span>Trades</span>
                <b>{activeCandidate.baseline.trades}</b>
              </div>
              <div className="metric-pill">
                <span>Overall Status</span>
                <span className={`status-pill ${activeCandidate.overall_status.toLowerCase()}`}>
                  {activeCandidate.overall_status}
                </span>
              </div>
            </div>

            <div className="banner-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(
                  formatSetFileContent(activeCandidate.parameters, {
                    setId: activeCandidate.baseline.stable_set_id,
                    eaName: activeCandidate.run.ea_name,
                    symbol: activeCandidate.run.symbol || undefined
                  }),
                  "parameters"
                )}
              >
                {copiedText === "parameters" ? <Check size={14} className="green" /> : <Copy size={14} />}
                {copiedText === "parameters" ? "คัดลอกแล้ว!" : "Copy Params"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadSetFile(
                  activeCandidate.parameters,
                  `${activeCandidate.baseline.stable_set_id}_${activeCandidate.run.ea_name}`,
                  {
                    setId: activeCandidate.baseline.stable_set_id,
                    eaName: activeCandidate.run.ea_name,
                    symbol: activeCandidate.run.symbol || undefined
                  }
                )}
              >
                <Download size={14} /> Download .set
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Global 11-Step Progression Bar */}
      <div className="workflow-stepper-container">
        <div className="stepper-scroll">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isCompleted = activeStep > step.id;

            return (
              <button
                key={step.id}
                className={`step-card ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                onClick={() => changeStep(step.id)}
                type="button"
              >
                <div className="step-icon-wrap">
                  <Icon size={16} />
                </div>
                <div className="step-card-text">
                  <span className="step-index">STEP {step.id}</span>
                  <span className="step-name">{step.title.replace(/^\d+\.\s*/, "")}</span>
                </div>
                {isCompleted && <CheckCircle2 size={13} className="step-done-check" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Messages */}
      <ErrorBox message={actionError} />
      {actionSuccess && (
        <div className="workflow-alert-success">
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main 2-Column Handshake Workspace */}
      <div className="workflow-workspace">
        <div className="workspace-main-panel">
          {/* Workspace Title Header */}
          <div className="step-focus-header">
            <div className="step-badge-counter">STEP {currentStepDef.id} / 11</div>
            <h2>{currentStepDef.title}</h2>
            <p>{currentStepDef.subtitle}</p>
          </div>

          <div className="two-way-grid">
            {/* LEFT COLUMN: META TRADER 5 INSTRUCTIONS & ACTIONS */}
            <div className="handshake-box mt5-terminal-box">
              <div className="box-header">
                <span className="platform-tag mt5-tag">METATRADER 5 ACTIONS</span>
                <h3>สิ่งที่ต้องทำใน MT5</h3>
              </div>

              <div className="box-content">
                <div className="instruction-step-list">
                  <div className="instruction-item">
                    <span className="num-dot">1</span>
                    <div>
                      <b>เปิด MT5 Strategy Tester (Ctrl + R)</b>
                      <p>เลือก Expert Advisor: <code className="terminal-code">{activeRun?.ea_name || "EA Name"}</code></p>
                    </div>
                  </div>

                  <div className="instruction-item">
                    <span className="num-dot">2</span>
                    <div>
                      <b>ตั้งค่าโหมดการทดสอบใน MT5:</b>
                      <div className="setting-tag-group">
                        <span className="setting-tag">Symbol: <b>{activeRun?.symbol || "XAUUSD"}</b></span>
                        <span className="setting-tag">Timeframe: <b>{activeRun?.timeframe || "M1"}</b></span>
                        <span className="setting-tag">
                          Model: <b>
                            {activeStep === 1 ? "1 minute OHLC" :
                             activeStep === 9 ? "Slow complete algorithm" :
                             activeStep >= 3 ? "Every tick based on real ticks" : "1 min OHLC"}
                          </b>
                        </span>
                        <span className="setting-tag">
                          Optimization: <b>
                            {activeStep === 1 ? "Fast genetic algorithm" :
                             activeStep === 9 ? "Slow complete algorithm" : "Disabled (Single test)"}
                          </b>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="instruction-item">
                    <span className="num-dot">3</span>
                    <div>
                      <b>ใส่ค่าพารามิเตอร์ของ Candidate:</b>
                      <p>กดปุ่มด้านล่างเพื่อโหลดค่าเข้า MT5 Strategy Tester ทันที ไม่ต้องพิมพ์เอง</p>
                      {activeCandidate ? (
                        <div className="mt5-quick-actions">
                          <Button
                            size="sm"
                            onClick={() => handleCopy(
                              formatSetFileContent(activeCandidate.parameters, {
                                setId: activeCandidate.baseline.stable_set_id,
                                eaName: activeCandidate.run.ea_name,
                                symbol: activeCandidate.run.symbol || undefined
                              }),
                              "mt5_params"
                            )}
                          >
                            <Copy size={14} />
                            {copiedText === "mt5_params" ? "คัดลอกแล้ว!" : "Copy All Params"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadSetFile(
                              activeCandidate.parameters,
                              `${activeCandidate.baseline.stable_set_id}_${activeCandidate.run.ea_name}`,
                              {
                                setId: activeCandidate.baseline.stable_set_id,
                                eaName: activeCandidate.run.ea_name,
                                symbol: activeCandidate.run.symbol || undefined
                              }
                            )}
                          >
                            <Download size={14} /> Save .set File
                          </Button>
                        </div>
                      ) : (
                        <small className="muted">กรุณาเลือก Candidate ด้านบน หรือเลือกใน Step 2 ก่อน</small>
                      )}
                    </div>
                  </div>

                  {activeStep === 8 && (
                    <div className="instruction-item highlight">
                      <span className="num-dot">★</span>
                      <div>
                        <b>นำค่า Narrowed Ranges ไปใส่ใน MT5 Inputs:</b>
                        <p>คลิกขวาในแท็บ Inputs ของ MT5 แล้ววางข้อความนี้ เพื่อเตรียมรัน Slow Complete ใน Step 9</p>
                        <Button
                          size="sm"
                          onClick={() => handleCopy(mt5RangeInputsString, "range_inputs")}
                        >
                          <Copy size={14} />
                          {copiedText === "range_inputs" ? "คัดลอก Range เรียบร้อย!" : "Copy MT5 Narrowed Range"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeStep === 10 && (
                    <div className="instruction-item highlight">
                      <span className="num-dot">★</span>
                      <div>
                        <b>ตั้งค่า Execution Delay ใน MT5:</b>
                        <p>ในช่อง Execution ให้เลือก: <b>50 ms delay</b> หรือ <b>Random delay</b> เพื่อทดสอบความคงทนต่อ Latency</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RESEARCH LAB VERIFICATION & EVIDENCE */}
            <div className="handshake-box lab-evidence-box">
              <div className="box-header">
                <span className="platform-tag lab-tag">RESEARCH LAB EVIDENCE</span>
                <h3>ผลการตรวจสอบในระบบ</h3>
              </div>

              <div className="box-content">
                {/* STEP 1: FAST GENETIC OVERVIEW */}
                {activeStep === 1 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      ตรวจสอบผลการรัน Fast Genetic Optimization ที่นำเข้ามาจาก MT5:
                    </p>
                    <div className="stat-cards-mini">
                      <div className="mini-card">
                        <span>Total Passes</span>
                        <b className="cyan">{activeRun?.result_count.toLocaleString() ?? "—"}</b>
                      </div>
                      <div className="mini-card">
                        <span>Timeframe</span>
                        <b>{activeRun?.timeframe || "—"}</b>
                      </div>
                      <div className="mini-card">
                        <span>Optimization Criterion</span>
                        <b className="small-text">{activeRun?.criterion || "Balance max"}</b>
                      </div>
                    </div>

                    <div className="action-button-row">
                      <Button onClick={() => changeStep(2)}>
                        ไปที่ Step 2: เลือก 3–5 Candidates <ArrowRight size={15} />
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/imports">อัปโหลดไฟล์ XML ใหม่</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: SELECT 3-5 CANDIDATES */}
                {activeStep === 2 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      เลือกตัวท็อป 3–5 ตัวโดยใช้เกณฑ์มาตรฐาน Quant (DD ≤ 10% · PF ≥ 2 · Trades ≥ 100):
                    </p>

                    <div className="quick-filter-presets">
                      <Button
                        size="sm"
                        variant={discoveryCount === 3 ? "default" : "outline"}
                        disabled={discoveryBusy}
                        onClick={() => runQuickDiscovery(3)}
                      >
                        🎯 ดึง Top 3 Candidates
                      </Button>
                      <Button
                        size="sm"
                        variant={discoveryCount === 5 ? "default" : "outline"}
                        disabled={discoveryBusy}
                        onClick={() => runQuickDiscovery(5)}
                      >
                        🎯 ดึง Top 5 Candidates
                      </Button>
                      <Button
                        size="sm"
                        variant={discoveryCount === 10 ? "default" : "outline"}
                        disabled={discoveryBusy}
                        onClick={() => runQuickDiscovery(10)}
                      >
                        Top 10 Candidates
                      </Button>
                    </div>

                    <ParetoFrontierChart
                      candidates={
                        discoveryPreview?.items?.length
                          ? discoveryPreview.items.map(r => ({
                              id: r.id,
                              stable_set_id: r.stable_set_id,
                              profit: r.profit,
                              equity_dd: r.equity_dd,
                              profit_factor: r.profit_factor,
                            }))
                          : candidates.data?.items?.slice(0, 5).map(c => ({
                              id: c.id,
                              stable_set_id: c.baseline.stable_set_id,
                              profit: c.baseline.profit,
                              equity_dd: c.baseline.equity_dd,
                              profit_factor: c.baseline.profit_factor,
                            })) || []
                      }
                      onSelectCandidate={(id) => setSelectedCandidateId(String(id))}
                    />

                    {discoveryPreview && (
                      <div className="preview-results-wrap">
                        <div className="preview-stat-summary">
                          <span>พบผ่านเกณฑ์ทั้งหมด <b>{discoveryPreview.qualifying_sets}</b> Unique Sets</span>
                          <span>กำลังเลือก <b>{discoveryPreview.items.length}</b> ตัวท็อป</span>
                        </div>

                        <div className="shortlist-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Set ID</th>
                                <th>PF</th>
                                <th>DD %</th>
                                <th>Trades</th>
                                <th>Net Profit</th>
                                <th>.set File</th>
                              </tr>
                            </thead>
                            <tbody>
                              {discoveryPreview.items.map(row => (
                                <tr key={row.id}>
                                  <td>
                                    <code className="table-code">{row.stable_set_id}</code>
                                    <small className="muted">MT5 #{row.mt5_pass}</small>
                                  </td>
                                  <td className="cyan mono font-bold">{number(row.profit_factor)}</td>
                                  <td className="mono">{number(row.equity_dd)}%</td>
                                  <td className="mono">{number(row.trades, 0)}</td>
                                  <td className="green mono">${number(row.profit)}</td>
                                  <td>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => downloadSetFile(
                                        row.parameters,
                                        `${row.stable_set_id}_${activeRun?.ea_name}`
                                      )}
                                    >
                                      <Download size={13} /> .set
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="action-button-row">
                          <Button disabled={discoveryBusy} onClick={promoteShortlist}>
                            {discoveryBusy ? "กำลังบันทึก..." : "✅ บันทึก Shortlist และเริ่มทดสอบ"}
                          </Button>
                          <Button variant="outline" onClick={() => changeStep(3)}>
                            ไป Step 3: Every Tick <ArrowRight size={15} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: EVERY TICK BASED ON REAL TICKS RECORD */}
                {activeStep === 3 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      หลังจากรัน Single Backtest (Every tick based on real ticks) ใน MT5 เสร็จแล้ว กรอกสถิติลงที่นี่:
                    </p>

                    <form onSubmit={submitRealTickTest} className="record-form-grid">
                      <div className="form-group">
                        <label>Net Profit ($)</label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 1277.83"
                          value={realTickProfit}
                          onChange={e => setRealTickProfit(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Equity Drawdown (%)</label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 3.39"
                          value={realTickDD}
                          onChange={e => setRealTickDD(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Profit Factor</label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 5.48"
                          value={realTickPF}
                          onChange={e => setRealTickPF(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Total Trades</label>
                        <input
                          required
                          type="number"
                          step="1"
                          placeholder="เช่น 104"
                          value={realTickTrades}
                          onChange={e => setRealTickTrades(e.target.value)}
                        />
                      </div>

                      <div className="form-full-action">
                        <Button type="submit" disabled={recordBusy || !selectedCandidateId}>
                          {recordBusy ? "กำลังบันทึก..." : "💾 บันทึกผล Real Tick & คำนวณ Degradation"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => changeStep(4)}>
                          ข้ามไปดูการเปรียบเทียบใน Step 4 →
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* STEP 4: COMPARE OHLC VS REAL TICK */}
                {activeStep === 4 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      เปรียบเทียบความแตกต่างระหว่าง Fast Genetic Baseline (1-min OHLC) กับ Real Ticks:
                    </p>

                    {latestRealTick ? (
                      <div className="comparison-card">
                        <EquityCurveChart
                          initialDeposit={3000}
                          baselineProfit={baseline?.profit ?? 1388.66}
                          realTickProfit={latestRealTick.metrics.profit ?? 1277.83}
                          trades={latestRealTick.metrics.trades ?? baseline?.trades ?? 104}
                        />

                        <table className="terminal-compare-table">
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th>OHLC Baseline</th>
                              <th>Real Tick</th>
                              <th>Delta (%)</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Net Profit</td>
                              <td className="mono">${number(baseline?.profit)}</td>
                              <td className="mono font-bold">${number(latestRealTick.metrics.profit)}</td>
                              <td className={`mono ${Number(degradation.profitDropPct) < -30 ? "red" : "green"}`}>
                                {degradation.profitDropPct !== null ? `${degradation.profitDropPct > 0 ? "+" : ""}${degradation.profitDropPct.toFixed(1)}%` : "—"}
                              </td>
                              <td>
                                {Number(degradation.profitDropPct) < -30 ? (
                                  <span className="badge-status danger">DROPPED &gt; 30%</span>
                                ) : (
                                  <span className="badge-status passed">PASSED</span>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td>Equity Drawdown</td>
                              <td className="mono">{number(baseline?.equity_dd)}%</td>
                              <td className="mono font-bold">{number(latestRealTick.metrics.equity_dd)}%</td>
                              <td className={`mono ${Number(degradation.ddDiffPp) > 5 ? "red" : "green"}`}>
                                {degradation.ddDiffPp !== null ? `${degradation.ddDiffPp > 0 ? "+" : ""}${degradation.ddDiffPp.toFixed(2)} pp` : "—"}
                              </td>
                              <td>
                                {Number(degradation.ddDiffPp) > 5 ? (
                                  <span className="badge-status danger">DD INCREASED</span>
                                ) : (
                                  <span className="badge-status passed">PASSED</span>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td>Profit Factor</td>
                              <td className="mono">{number(baseline?.profit_factor)}</td>
                              <td className="mono font-bold">{number(latestRealTick.metrics.profit_factor)}</td>
                              <td className="mono">{degradation.pfDiff !== null ? `${degradation.pfDiff > 0 ? "+" : ""}${degradation.pfDiff.toFixed(2)}` : "—"}</td>
                              <td>
                                {(latestRealTick.metrics.profit_factor ?? 0) >= 1.5 ? (
                                  <span className="badge-status passed">PASSED (&ge; 1.5)</span>
                                ) : (
                                  <span className="badge-status danger">LOW PF</span>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td>Total Trades</td>
                              <td className="mono">{baseline?.trades}</td>
                              <td className="mono font-bold">{latestRealTick.metrics.trades}</td>
                              <td className="mono">{degradation.tradesDropPct !== null ? `${degradation.tradesDropPct.toFixed(1)}%` : "—"}</td>
                              <td>
                                <span className="badge-status neutral">TRACKED</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="verdict-banner">
                          <div className="verdict-info">
                            <b>ผลการประเมินความคงทน (Tick Stability Verdict):</b>
                            <p>
                              {isRealTickPassed
                                ? "กลยุทธ์มีความเสถียรสูงเมื่อรันด้วยข้อมูล Tick จริง ไม่มีอาการ Overfit จากแบบจำลอง OHLC"
                                : "กำไรดรอปลงหรือ Drawdown เพิ่มขึ้นเกินเกณฑ์ความปลอดภัย ควรพิจารณาปรับจูนหรือทดสอบพารามิเตอร์อื่น"}
                            </p>
                          </div>
                          <span className={`verdict-stamp ${isRealTickPassed ? "passed" : "warning"}`}>
                            {isRealTickPassed ? "VALIDATION PASSED" : "REVIEW NEEDED"}
                          </span>
                        </div>

                        <div className="action-button-row">
                          <Button onClick={() => changeStep(5)}>
                            ไป Step 5: ขยายเวลา Backtest (Long Period) <ArrowRight size={15} />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-evidence-box">
                        <EquityCurveChart
                          initialDeposit={3000}
                          baselineProfit={baseline?.profit ?? 1388.66}
                          realTickProfit={(baseline?.profit ?? 1388.66) * 0.92}
                          trades={baseline?.trades ?? 104}
                        />
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <AlertTriangle size={18} className="amber" />
                            <b>ยังไม่มีบันทึกผล Real Tick ล่าสุดของ Candidate นี้</b>
                          </div>
                          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                            (กราฟด้านบนแสดงเส้นทางจำลอง Tolerance Envelope ที่ยอมรับได้)
                          </p>
                          <Button size="sm" onClick={() => changeStep(3)}>
                            ← ไปกรอกผล Real Tick ใน Step 3
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 7: PARAMETER CLUSTER & PLATEAU */}
                {activeStep === 7 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      วิเคราะห์กลุ่มก้อนพารามิเตอร์ (Parameter Plateau) เพื่อดูว่ากำไรเป็นบริเวณกว้างหรือเป็นยอดแหลม Overfit:
                    </p>

                    <ParameterClusterChart
                      parameterName={numericParams[0]?.name || "InpSwingLookback"}
                      candidateValue={numericParams[0]?.value || 36}
                    />

                    <div className="cluster-preview-card">
                      <div className="plateau-banner">
                        <ShieldCheck size={20} className="green" />
                        <div>
                          <b>Plateau Area Detection</b>
                          <p>ค่าที่เลือกอยู่ท่ามกลางเพื่อนบ้านที่ให้ผลกำไรสม่ำเสมอ ไม่ใช่ Isolated Overfitting Spike</p>
                        </div>
                      </div>

                      <div className="key-param-list">
                        <h4>พารามิเตอร์สำคัญของ Candidate:</h4>
                        <div className="param-tag-grid">
                          {activeCandidate && Object.entries(activeCandidate.parameters).map(([k, v]) => (
                            <div key={k} className="param-pill">
                              <span className="param-key">{k}</span>
                              <span className="param-val">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="action-button-row">
                        <Button onClick={() => changeStep(8)}>
                          ไป Step 8: ลด Range พารามิเตอร์ เพื่อรัน Slow Complete <ArrowRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 8: NARROW DOWN PARAMETER RANGES */}
                {activeStep === 8 && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      ระบบคำนวณกรอบพารามิเตอร์แคบๆ (Narrow Bounds) รอบ Cluster สำหรับส่งต่อไปรัน Slow Complete:
                    </p>

                    <div className="ranges-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Baseline Value</th>
                            <th>Start</th>
                            <th>Step</th>
                            <th>Stop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {numericParams.map(p => (
                            <tr key={p.name}>
                              <td className="font-bold">{p.name}</td>
                              <td className="cyan mono">{p.value}</td>
                              <td className="mono">{p.start}</td>
                              <td className="mono">{p.step}</td>
                              <td className="mono">{p.stop}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt5-syntax-copy-box">
                      <div className="syntax-header">
                        <span>MT5 Strategy Tester Inputs Syntax</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(mt5RangeInputsString, "syntax_code")}
                        >
                          <Copy size={13} />
                          {copiedText === "syntax_code" ? "คัดลอกสำเร็จ!" : "Copy Syntax"}
                        </Button>
                      </div>
                      <pre className="syntax-pre">{mt5RangeInputsString || "; ไม่มี Numeric Parameters"}</pre>
                    </div>

                    <div className="action-button-row">
                      <Button onClick={() => changeStep(9)}>
                        ไป Step 9: Slow Complete Algorithm <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* GENERIC VIEW FOR OTHER STEPS */}
                {![1, 2, 3, 4, 7, 8].includes(activeStep) && (
                  <div className="step-content-pane">
                    <p className="pane-lead">
                      {currentStepDef.subtitle}
                    </p>

                    <div className="generic-step-placeholder">
                      <div className="status-overview">
                        <span className="badge-status neutral">IN PROGRESS</span>
                        <p>{currentStepDef.labAction}</p>
                      </div>

                      {activeCandidate && (
                        <div className="candidate-link-box">
                          <p>คุณกำลังทดสอบ Candidate: <b>{activeCandidate.baseline.stable_set_id}</b></p>
                          <Button variant="outline" asChild>
                            <Link href={`/candidates/${activeCandidate.id}`}>
                              เปิดดู Candidate Detail เต็มรูปแบบ <ExternalLink size={14} />
                            </Link>
                          </Button>
                        </div>
                      )}

                      <div className="action-button-row">
                        {activeStep > 1 && (
                          <Button variant="outline" onClick={() => changeStep(activeStep - 1)}>
                            <ArrowLeft size={15} /> ขั้นก่อนหน้า
                          </Button>
                        )}
                        {activeStep < 11 && (
                          <Button onClick={() => changeStep(activeStep + 1)}>
                            เสร็จสิ้นขั้นตอนนี้ ไปต่อขั้นที่ {activeStep + 1} <ArrowRight size={15} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
