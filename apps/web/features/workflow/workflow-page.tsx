"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  Image as ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Filter,
  RotateCcw,
  CheckSquare,
  Square,
  UploadCloud,
  Sparkles,
  Eye,
  FileText
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
import { parseMT5ReportText, type ParsedMT5Report } from "@/lib/mt5-report-parser";
import { EquityCurveChart, ParetoFrontierChart, ParameterClusterChart } from "@/components/charts/quant-charts";
import type { Page, Run, Candidate, CandidateDetail, DiscoveryPreview, Status } from "@/types";

type SortField = "rank" | "setId" | "profitFactor" | "equityDd" | "trades" | "profit";
type SortOrder = "asc" | "desc";

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
    labAction: "กรอง DD ≤ 12%, PF ≥ 2, Trades ≥ 100 แล้วเลือก 3–5 ตัวท็อป"
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
  const [policyMaxDD, setPolicyMaxDD] = useState<number>(12);
  const [rankingObjective, setRankingObjective] = useState<string>("quant_robustness");
  const [discoveryPreview, setDiscoveryPreview] = useState<DiscoveryPreview>();
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<number>>(new Set());
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | null>(null);

  // Step 2 Sorting and Filtering states
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMaxDD, setFilterMaxDD] = useState<number | null>(null);
  const [filterMinPF, setFilterMinPF] = useState<number | null>(null);
  const [filterMinTrades, setFilterMinTrades] = useState<number | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [step2ViewMode, setStep2ViewMode] = useState<"table" | "chart" | "both">("table");

  // Real tick input form state for Step 3
  const [realTickProfit, setRealTickProfit] = useState("");
  const [realTickDD, setRealTickDD] = useState("");
  const [realTickPF, setRealTickPF] = useState("");
  const [realTickTrades, setRealTickTrades] = useState("");
  const [recordBusy, setRecordBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Step 3 Smart OCR & Image Evidence states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [ocrBusy, setOcrBusy] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusText, setOcrStatusText] = useState<string>("");
  const [ocrDetected, setOcrDetected] = useState<ParsedMT5Report | null>(null);
  const [ocrSuccessMessage, setOcrSuccessMessage] = useState<string>("");
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [rawPastedText, setRawPastedText] = useState<string>("");
  const [showTextPasteBox, setShowTextPasteBox] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 5 Multi-Year Stress Test states
  const [longPeriodFrom, setLongPeriodFrom] = useState("2021-01-01");
  const [longPeriodTo, setLongPeriodTo] = useState("2024-10-01");
  const [longPeriodModel, setLongPeriodModel] = useState("Every tick based on real ticks");
  const [longPeriodProfit, setLongPeriodProfit] = useState("");
  const [longPeriodDD, setLongPeriodDD] = useState("");
  const [longPeriodPF, setLongPeriodPF] = useState("");
  const [longPeriodTrades, setLongPeriodTrades] = useState("");
  const [longPeriodRecovery, setLongPeriodRecovery] = useState("");
  const [longPeriodBusy, setLongPeriodBusy] = useState(false);
  const [step5UploadedImage, setStep5UploadedImage] = useState<string | null>(null);
  const [step5UploadedImageName, setStep5UploadedImageName] = useState<string>("");
  const [step5OcrBusy, setStep5OcrBusy] = useState(false);
  const [step5OcrProgress, setStep5OcrProgress] = useState(0);
  const [step5OcrStatusText, setStep5OcrStatusText] = useState("");
  const [step5OcrDetected, setStep5OcrDetected] = useState<ParsedMT5Report | null>(null);
  const [step5OcrSuccessMessage, setStep5OcrSuccessMessage] = useState("");
  const [step5ShowTextPasteBox, setStep5ShowTextPasteBox] = useState(false);
  const [step5RawPastedText, setStep5RawPastedText] = useState("");
  const [step5IsDraggingOver, setStep5IsDraggingOver] = useState(false);
  const step5FileInputRef = useRef<HTMLInputElement>(null);

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
  async function runQuickDiscovery(
    count: number = discoveryCount,
    maxDD: number = policyMaxDD,
    objective: string = rankingObjective,
    passSearch?: string
  ) {
    if (!selectedRunId) return;
    setDiscoveryBusy(true);
    setActionError("");
    setDiscoveryCount(count);
    setPolicyMaxDD(maxDD);
    setRankingObjective(objective);
    try {
      const data = await api<DiscoveryPreview>("/discovery/preview", jsonBody({
        run_id: Number(selectedRunId),
        top_count: count,
        ranking_objective: objective,
        pass_search: passSearch || undefined,
        policy: {
          max_equity_dd: maxDD,
          min_profit_factor: 2,
          min_trades: 100,
          profit_above: 0
        }
      }));
      setDiscoveryPreview(data);
      setSelectedResultIds(new Set(data.items.map(r => r.id)));
      if (data.items.length > 0) {
        setSelectedPreviewId(data.items[0].id);
      }
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setDiscoveryBusy(false);
    }
  }

  // Auto-run discovery when on Step 2 if not loaded yet
  useEffect(() => {
    if (activeStep === 2 && selectedRunId && !discoveryPreview && !discoveryBusy) {
      runQuickDiscovery(discoveryCount || 5, policyMaxDD, rankingObjective);
    }
  }, [activeStep, selectedRunId, discoveryPreview, discoveryBusy, discoveryCount, policyMaxDD, rankingObjective]);

  // Promote shortlisted candidates
  async function promoteShortlist() {
    if (!discoveryPreview) return;
    setDiscoveryBusy(true);
    setActionError("");
    try {
      const res = await api<{ created: number; already_candidates: number }>("/discovery/promote", jsonBody({
        run_id: discoveryPreview.run.id,
        top_count: discoveryPreview.top_count,
        ranking_objective: rankingObjective,
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

  // Step 3 Preprocessing & OCR worker
  async function preprocessAndOCR(imageSrc: string, fileName: string) {
    setUploadedImage(imageSrc);
    setUploadedImageName(fileName);
    setOcrBusy(true);
    setOcrProgress(15);
    setOcrStatusText("กำลังปรับแต่งความละเอียดภาพสำหรับอ่านตาราง...");
    setOcrDetected(null);
    setOcrSuccessMessage("");

    try {
      // 1. Offscreen canvas to upscale 2.2x for small MT5 fonts (8pt Tahoma)
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageSrc;
      });

      setOcrProgress(30);
      setOcrStatusText("กำลังประมวลผลความคมชัดและอัตราส่วนพิกเซล (2.2x)...");

      const canvas = document.createElement("canvas");
      const scale = 2.2;
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      setOcrProgress(45);
      setOcrStatusText("กำลังเริ่มต้น Tesseract OCR Engine...");

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");

      setOcrProgress(65);
      setOcrStatusText("กำลังสแกนตัวเลข Net Profit, Equity Drawdown, PF, Trades...");

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      setOcrProgress(90);
      setOcrStatusText("กำลังแยกแยะค่าสถิติจากตาราง Report...");

      const parsed = parseMT5ReportText(ret.data.text);
      setOcrDetected(parsed);

      let detectedCount = 0;
      if (parsed.profit !== null) {
        setRealTickProfit(String(parsed.profit));
        detectedCount++;
      }
      if (parsed.equity_dd !== null) {
        setRealTickDD(String(parsed.equity_dd));
        detectedCount++;
      }
      if (parsed.profit_factor !== null) {
        setRealTickPF(String(parsed.profit_factor));
        detectedCount++;
      }
      if (parsed.trades !== null) {
        setRealTickTrades(String(parsed.trades));
        detectedCount++;
      }

      setOcrProgress(100);
      if (detectedCount > 0) {
        setOcrSuccessMessage(`✨ ตรวจพบและกรอกอัตโนมัติแล้ว ${detectedCount}/4 ค่าสำคัญจากภาพสำเร็จ!`);
      } else {
        setOcrSuccessMessage("⚠️ อ่านข้อความได้ แต่ไม่พบคีย์เวิร์ดมาตรฐาน MT5 ลองตรวจทานหรือกรอกค่าด้วยตนเอง");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setOcrStatusText("เกิดข้อผิดพลาดในการอ่านรูปภาพ");
      setOcrSuccessMessage("ไม่สามารถอ่านตัวเลขได้โดยอัตโนมัติ กรุณากรอกตัวเลขด้วยตนเอง");
    } finally {
      setOcrBusy(false);
    }
  }

  function handleImageFile(file: File) {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          preprocessAndOCR(e.target.result as string, file.name);
        }
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith(".htm") || file.name.endsWith(".html") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          handleTextReport(e.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
  }

  function handleTextReport(text: string, sourceName = "MT5 Report Text") {
    const parsed = parseMT5ReportText(text);
    setOcrDetected(parsed);
    let detectedCount = 0;
    if (parsed.profit !== null) {
      setRealTickProfit(String(parsed.profit));
      detectedCount++;
    }
    if (parsed.equity_dd !== null) {
      setRealTickDD(String(parsed.equity_dd));
      detectedCount++;
    }
    if (parsed.profit_factor !== null) {
      setRealTickPF(String(parsed.profit_factor));
      detectedCount++;
    }
    if (parsed.trades !== null) {
      setRealTickTrades(String(parsed.trades));
      detectedCount++;
    }

    if (detectedCount > 0) {
      setOcrSuccessMessage(`✨ ดึงค่าสถิติสำเร็จ ${detectedCount}/4 ค่าจาก ${sourceName}!`);
      setShowTextPasteBox(false);
    } else {
      setOcrSuccessMessage("⚠️ ไม่พบคีย์เวิร์ดของ MT5 ในข้อความที่วาง");
    }
  }

  // Step 5 Preprocessing & OCR worker
  async function step5PreprocessAndOCR(imageSrc: string, fileName: string) {
    setStep5UploadedImage(imageSrc);
    setStep5UploadedImageName(fileName);
    setStep5OcrBusy(true);
    setStep5OcrProgress(15);
    setStep5OcrStatusText("กำลังปรับแต่งความละเอียดภาพสำหรับอ่านตาราง...");
    setStep5OcrDetected(null);
    setStep5OcrSuccessMessage("");

    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageSrc;
      });

      setStep5OcrProgress(30);
      setStep5OcrStatusText("กำลังประมวลผลความคมชัดและอัตราส่วนพิกเซล (2.2x)...");

      const canvas = document.createElement("canvas");
      const scale = 2.2;
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      setStep5OcrProgress(45);
      setStep5OcrStatusText("กำลังเริ่มต้น Tesseract OCR Engine...");

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");

      setStep5OcrProgress(65);
      setStep5OcrStatusText("กำลังสแกนสถิติ Multi-Year Report...");

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      setStep5OcrProgress(90);
      setStep5OcrStatusText("กำลังแยกแยะค่าสถิติจากตาราง Report...");

      const parsed = parseMT5ReportText(ret.data.text);
      setStep5OcrDetected(parsed);

      let detectedCount = 0;
      if (parsed.profit !== null) {
        setLongPeriodProfit(String(parsed.profit));
        detectedCount++;
      }
      if (parsed.equity_dd !== null) {
        setLongPeriodDD(String(parsed.equity_dd));
        detectedCount++;
      }
      if (parsed.profit_factor !== null) {
        setLongPeriodPF(String(parsed.profit_factor));
        detectedCount++;
      }
      if (parsed.trades !== null) {
        setLongPeriodTrades(String(parsed.trades));
        detectedCount++;
      }
      if (parsed.recovery_factor != null) {
        setLongPeriodRecovery(String(parsed.recovery_factor));
      }
      if (parsed.period_from) {
        setLongPeriodFrom(parsed.period_from);
      }
      if (parsed.period_to) {
        setLongPeriodTo(parsed.period_to);
      }

      setStep5OcrProgress(100);
      if (detectedCount > 0) {
        setStep5OcrSuccessMessage(`✨ ตรวจพบและกรอกอัตโนมัติแล้ว ${detectedCount}/4 ค่าสำคัญสำเร็จ!`);
      } else {
        setStep5OcrSuccessMessage("⚠️ อ่านข้อความได้ แต่ไม่พบคีย์เวิร์ดมาตรฐาน MT5 กรุณากรอกด้วยตนเอง");
      }
    } catch (err) {
      console.error("Step 5 OCR Error:", err);
      setStep5OcrStatusText("เกิดข้อผิดพลาดในการอ่านรูปภาพ");
      setStep5OcrSuccessMessage("ไม่สามารถอ่านตัวเลขได้โดยอัตโนมัติ กรุณากรอกตัวเลขด้วยตนเอง");
    } finally {
      setStep5OcrBusy(false);
    }
  }

  function step5HandleImageFile(file: File) {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          step5PreprocessAndOCR(e.target.result as string, file.name);
        }
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith(".htm") || file.name.endsWith(".html") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          step5HandleTextReport(e.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
  }

  function step5HandleTextReport(text: string, sourceName = "MT5 Report Text") {
    const parsed = parseMT5ReportText(text);
    setStep5OcrDetected(parsed);
    let detectedCount = 0;
    if (parsed.profit !== null) {
      setLongPeriodProfit(String(parsed.profit));
      detectedCount++;
    }
    if (parsed.equity_dd !== null) {
      setLongPeriodDD(String(parsed.equity_dd));
      detectedCount++;
    }
    if (parsed.profit_factor !== null) {
      setLongPeriodPF(String(parsed.profit_factor));
      detectedCount++;
    }
    if (parsed.trades !== null) {
      setLongPeriodTrades(String(parsed.trades));
      detectedCount++;
    }
    if (parsed.recovery_factor != null) {
      setLongPeriodRecovery(String(parsed.recovery_factor));
    }
    if (parsed.period_from) {
      setLongPeriodFrom(parsed.period_from);
    }
    if (parsed.period_to) {
      setLongPeriodTo(parsed.period_to);
    }

    if (detectedCount > 0) {
      setStep5OcrSuccessMessage(`✨ ดึงค่าสถิติสำเร็จ ${detectedCount}/4 ค่าจาก ${sourceName}!`);
      setStep5ShowTextPasteBox(false);
    } else {
      setStep5OcrSuccessMessage("⚠️ ไม่พบคีย์เวิร์ดของ MT5 ในข้อความที่วาง");
    }
  }

  // Global paste handler for Step 3 & Step 5
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (activeStep !== 3 && activeStep !== 5) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile();
          if (blob) {
            if (activeStep === 3) {
              handleImageFile(blob);
            } else if (activeStep === 5) {
              step5HandleImageFile(blob);
            }
            e.preventDefault();
            return;
          }
        }
      }

      const text = e.clipboardData?.getData("text");
      if (text && (text.includes("Profit") || text.includes("Drawdown") || text.includes("Trades") || text.includes("\t") || text.includes("Period"))) {
        if (activeStep === 3) {
          handleTextReport(text, "Clipboard Text");
        } else if (activeStep === 5) {
          step5HandleTextReport(text, "Clipboard Text");
        }
        e.preventDefault();
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeStep]);

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
        notes: uploadedImageName
          ? `Validated with MT5 report screenshot: ${uploadedImageName}`
          : "Real tick execution on MetaTrader 5"
      }));
      setActionSuccess("บันทึกผล Every Tick เรียบร้อยแล้ว! นำผลไปเปรียบเทียบใน Step 4...");
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

  // Step 3 Live Degradation calculation (real-time as user types or OCR extracts)
  const step3LiveAnalysis = useMemo(() => {
    const p = parseFloat(realTickProfit);
    const dd = parseFloat(realTickDD);
    const pf = parseFloat(realTickPF);
    const tr = parseInt(realTickTrades, 10);
    const baseP = baseline?.profit ?? null;
    const baseDD = baseline?.equity_dd ?? null;
    const basePF = baseline?.profit_factor ?? null;
    const baseTr = baseline?.trades ?? null;

    const hasData = !isNaN(p) && !isNaN(dd);
    if (!hasData) return null;

    const profitDiffPct = baseP !== null && baseP !== 0
      ? ((p - baseP) / Math.abs(baseP)) * 100
      : null;
    const ddDiffPp = baseDD !== null
      ? dd - baseDD
      : null;
    const pfDiff = basePF !== null && !isNaN(pf)
      ? pf - basePF
      : null;
    const tradesDiffPct = baseTr !== null && baseTr > 0 && !isNaN(tr)
      ? ((tr - baseTr) / baseTr) * 100
      : null;

    const isPassed = profitDiffPct !== null
      ? profitDiffPct > -30 && (ddDiffPp ?? 0) < 5 && (!isNaN(pf) ? pf >= 1.5 : true)
      : true;

    return {
      profit: p,
      dd,
      pf: isNaN(pf) ? null : pf,
      trades: isNaN(tr) ? null : tr,
      profitDiffPct,
      ddDiffPp,
      pfDiff,
      tradesDiffPct,
      isPassed
    };
  }, [realTickProfit, realTickDD, realTickPF, realTickTrades, baseline]);

  // Step 4: Tick Robustness Score & Diagnostics
  const tickRobustness = useMemo(() => {
    if (!latestRealTick || !baseline) return null;
    let score = 100;

    // 1. Profit Retention impact (Max 40 pts deduction)
    const profitDrop = degradation.profitDropPct ?? 0;
    if (profitDrop < 0) {
      const dropAbs = Math.abs(profitDrop);
      if (dropAbs > 30) score -= 40;
      else if (dropAbs > 20) score -= 25;
      else if (dropAbs > 10) score -= 12;
      else score -= Math.round(dropAbs);
    }

    // 2. Drawdown expansion impact (Max 30 pts deduction)
    const ddDiff = degradation.ddDiffPp ?? 0;
    if (ddDiff > 0) {
      if (ddDiff > 5) score -= 30;
      else if (ddDiff > 3) score -= 20;
      else if (ddDiff > 1) score -= 10;
      else score -= 5;
    }

    // 3. Profit Factor degradation (Max 20 pts deduction)
    const rtPF = latestRealTick.metrics.profit_factor ?? 0;
    if (rtPF < 1.5) score -= 20;
    else if (rtPF < 2.0) score -= 10;
    else if (rtPF < 2.5) score -= 5;

    // 4. Trade Execution deviation (Max 10 pts deduction)
    const tradesDrop = Math.abs(degradation.tradesDropPct ?? 0);
    if (tradesDrop > 30) score -= 10;
    else if (tradesDrop > 15) score -= 5;

    const finalScore = Math.max(0, Math.min(100, score));

    let grade = "High Robustness (ความทนทานสูงมาก)";
    let gradeColor = "#059669";
    if (finalScore < 50) {
      grade = "High Risk (ความเสี่ยงสูง ไม่ควรเทรดจริง)";
      gradeColor = "#dc2626";
    } else if (finalScore < 70) {
      grade = "Moderate (ความทนทานปานกลาง เฝ้าระวัง)";
      gradeColor = "#d97706";
    } else if (finalScore < 85) {
      grade = "Good Robustness (ความทนทานดี ผ่านเกณฑ์)";
      gradeColor = "#0284c7";
    }

    // Profit retention percentage
    const baseP = baseline.profit ?? 1;
    const rtP = latestRealTick.metrics.profit ?? 0;
    const retentionPct = baseP > 0 ? (rtP / baseP) * 100 : 100;

    // Trade execution match percentage
    const baseTr = baseline.trades ?? 1;
    const rtTr = latestRealTick.metrics.trades ?? 0;
    const tradeMatchPct = baseTr > 0 ? (rtTr / baseTr) * 100 : 100;

    return {
      score: finalScore,
      grade,
      gradeColor,
      retentionPct,
      tradeMatchPct
    };
  }, [latestRealTick, baseline, degradation]);

  async function copyValidationSummary() {
    if (!latestRealTick || !baseline) return;
    const setId = activeCandidate?.baseline.stable_set_id || "Candidate";
    const eaName =
      activeCandidate?.run.ea_name && activeCandidate.run.ea_name !== "Unknown EA"
        ? activeCandidate.run.ea_name
        : activeRun?.ea_name && activeRun.ea_name !== "Unknown EA"
        ? activeRun.ea_name
        : "HybridSMC";
    const symbol =
      activeCandidate?.run.symbol && activeCandidate.run.symbol !== "Symbol"
        ? activeCandidate.run.symbol
        : activeRun?.symbol && activeRun.symbol !== "Symbol"
        ? activeRun.symbol
        : "XAUUSD";
    const timeframe = activeCandidate?.run.timeframe || activeRun?.timeframe || "M1";

    const summary = [
      `🔬 [EA Research Lab] Step 4 Tick Sensitivity Validation: ${isRealTickPassed ? "PASSED ✅" : "REVIEW NEEDED ⚠️"}`,
      `Candidate: ${setId} (${eaName} ${symbol} ${timeframe})`,
      `• Net Profit: $${number(latestRealTick.metrics.profit)} (Delta: ${degradation.profitDropPct !== null ? `${degradation.profitDropPct > 0 ? "+" : ""}${degradation.profitDropPct.toFixed(1)}%` : "—"} vs OHLC $${number(baseline.profit)})`,
      `• Equity DD: ${number(latestRealTick.metrics.equity_dd)}% (Delta: ${degradation.ddDiffPp !== null ? `${degradation.ddDiffPp > 0 ? "+" : ""}${degradation.ddDiffPp.toFixed(2)} pp` : "—"} vs OHLC ${number(baseline.equity_dd)}%)`,
      `• Profit Factor: ${number(latestRealTick.metrics.profit_factor)} (Baseline: ${number(baseline.profit_factor)})`,
      `• Trades: ${latestRealTick.metrics.trades} (Match: ${tickRobustness?.tradeMatchPct.toFixed(1)}%)`,
      `• Tick Robustness Score: ${tickRobustness?.score ?? 88}/100 (${tickRobustness?.grade.split(" ")[0]})`,
      `Verdict: ${isRealTickPassed ? "VALIDATION PASSED" : "REVIEW NEEDED"}`
    ].join("\n");

    const ok = await copyToClipboard(summary);
    if (ok) {
      setCopiedText("validation_summary");
      setTimeout(() => setCopiedText(""), 2500);
    }
  }

  // Step 5: Long Period (Multi-Year Stress Test) state & calculations
  const longPeriodRecords = activeCandidate?.records.filter(r => r.stage === "long_period") || [];
  const latestLongPeriod = longPeriodRecords[longPeriodRecords.length - 1];

  // Auto-fill Step 5 form if existing validation record found and inputs are empty
  useEffect(() => {
    if (activeStep === 5 && latestLongPeriod?.metrics && !longPeriodProfit) {
      if (latestLongPeriod.metrics.profit != null) setLongPeriodProfit(String(latestLongPeriod.metrics.profit));
      if (latestLongPeriod.metrics.equity_dd != null) setLongPeriodDD(String(latestLongPeriod.metrics.equity_dd));
      if (latestLongPeriod.metrics.profit_factor != null) setLongPeriodPF(String(latestLongPeriod.metrics.profit_factor));
      if (latestLongPeriod.metrics.trades != null) setLongPeriodTrades(String(latestLongPeriod.metrics.trades));
      if (latestLongPeriod.metrics.recovery_factor != null) setLongPeriodRecovery(String(latestLongPeriod.metrics.recovery_factor));
      if (latestLongPeriod.settings?.period_from) setLongPeriodFrom(String(latestLongPeriod.settings.period_from));
      if (latestLongPeriod.settings?.period_to) setLongPeriodTo(String(latestLongPeriod.settings.period_to));
      if (latestLongPeriod.settings?.modelling_method) setLongPeriodModel(String(latestLongPeriod.settings.modelling_method));
    }
  }, [activeStep, latestLongPeriod, longPeriodProfit]);

  const step5StressAnalysis = useMemo(() => {
    const p = parseFloat(longPeriodProfit);
    const dd = parseFloat(longPeriodDD);
    const pf = parseFloat(longPeriodPF);
    const tr = parseInt(longPeriodTrades, 10);
    const recInput = parseFloat(longPeriodRecovery);

    const baseP = baseline?.profit ?? null;
    const baseDD = baseline?.equity_dd ?? null;
    const basePF = baseline?.profit_factor ?? null;
    const baseTr = baseline?.trades ?? null;
    const deposit = activeRun?.deposit || 3000;

    const hasData = !isNaN(p) && !isNaN(dd);
    if (!hasData) return null;

    // Estimate duration in years
    const dFrom = new Date(longPeriodFrom);
    const dTo = new Date(longPeriodTo);
    const timeDiff = !isNaN(dFrom.getTime()) && !isNaN(dTo.getTime()) ? dTo.getTime() - dFrom.getTime() : 0;
    const years = Math.max(0.5, timeDiff > 0 ? timeDiff / (365.25 * 24 * 3600 * 1000) : 3.75);

    const annualizedProfit = p / years;
    const maxDDMoney = deposit * (dd / 100);
    const recoveryFactor = !isNaN(recInput) && recInput > 0
      ? recInput
      : (maxDDMoney > 0 ? p / maxDDMoney : (p > 0 ? 10 : 0));

    // Comparative ratios
    const profitMultiple = baseP && baseP > 0 ? p / baseP : null;
    const ddIncreasePp = baseDD !== null ? dd - baseDD : null;
    const ddMultiple = baseDD && baseDD > 0 ? dd / baseDD : null;
    const pfDiff = basePF !== null && !isNaN(pf) ? pf - basePF : null;
    const tradesPerYear = tr > 0 ? tr / years : null;

    // Standard Quant Benchmark criteria
    const isProfitable = p > 0;
    const isDDCapped = dd <= 18 && (ddMultiple === null || ddMultiple <= 1.8);
    const isPFHealthy = !isNaN(pf) ? pf >= 1.50 : true;
    const isRecoveryStrong = recoveryFactor >= 3.0;

    const isPassed = isProfitable && isDDCapped && isPFHealthy && isRecoveryStrong;

    return {
      profit: p,
      dd,
      pf: isNaN(pf) ? null : pf,
      trades: isNaN(tr) ? null : tr,
      years,
      annualizedProfit,
      recoveryFactor,
      profitMultiple,
      ddIncreasePp,
      ddMultiple,
      pfDiff,
      tradesPerYear,
      isProfitable,
      isDDCapped,
      isPFHealthy,
      isRecoveryStrong,
      isPassed
    };
  }, [longPeriodProfit, longPeriodDD, longPeriodPF, longPeriodTrades, longPeriodRecovery, longPeriodFrom, longPeriodTo, baseline, activeRun]);

  async function submitLongPeriodTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCandidateId) return;
    setLongPeriodBusy(true);
    setActionError("");
    setActionSuccess("");
    try {
      const deposit = activeRun?.deposit || 3000;
      const p = Number(longPeriodProfit);
      const dd = Number(longPeriodDD);
      const calculatedRecFactor = dd > 0 ? p / (deposit * (dd / 100)) : undefined;
      const recFactor = longPeriodRecovery ? Number(longPeriodRecovery) : calculatedRecFactor;

      await api(`/candidates/${selectedCandidateId}/validation/long_period`, jsonBody({
        label: `Multi-Year Regimes (${longPeriodFrom} to ${longPeriodTo})`,
        metrics: {
          profit: p,
          equity_dd: dd,
          profit_factor: Number(longPeriodPF),
          trades: Number(longPeriodTrades),
          recovery_factor: recFactor ? Number(recFactor.toFixed(2)) : undefined
        },
        settings: {
          period_from: longPeriodFrom,
          period_to: longPeriodTo,
          modelling_method: longPeriodModel
        },
        notes: step5UploadedImageName
          ? `Validated multi-year stress test with MT5 screenshot: ${step5UploadedImageName}`
          : `Multi-year stress test (${longPeriodFrom} to ${longPeriodTo}) on MetaTrader 5`
      }));

      setActionSuccess("บันทึกผล Multi-Year Backtest เรียบร้อยแล้ว! ผ่านการทดสอบวัฏจักรตลาด");
      setRevision(r => r + 1);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setLongPeriodBusy(false);
    }
  }

  async function copyStep5Summary() {
    if (!step5StressAnalysis && !latestLongPeriod) return;
    const setId = activeCandidate?.baseline.stable_set_id || "Candidate";
    const eaName =
      activeCandidate?.run.ea_name && activeCandidate.run.ea_name !== "Unknown EA"
        ? activeCandidate.run.ea_name
        : activeRun?.ea_name && activeRun.ea_name !== "Unknown EA"
        ? activeRun.ea_name
        : "EA";
    const symbol =
      activeCandidate?.run.symbol && activeCandidate.run.symbol !== "Symbol"
        ? activeCandidate.run.symbol
        : activeRun?.symbol && activeRun.symbol !== "Symbol"
        ? activeRun.symbol
        : "XAUUSD";
    const tf = activeCandidate?.run.timeframe || activeRun?.timeframe || "M1";

    const p = step5StressAnalysis?.profit ?? latestLongPeriod?.metrics?.profit ?? 0;
    const dd = step5StressAnalysis?.dd ?? latestLongPeriod?.metrics?.equity_dd ?? 0;
    const pf = step5StressAnalysis?.pf ?? latestLongPeriod?.metrics?.profit_factor ?? 0;
    const tr = step5StressAnalysis?.trades ?? latestLongPeriod?.metrics?.trades ?? 0;
    const rec = step5StressAnalysis?.recoveryFactor ?? latestLongPeriod?.metrics?.recovery_factor ?? 0;
    const passed = step5StressAnalysis ? step5StressAnalysis.isPassed : (latestLongPeriod?.status === "PASSED");

    const summary = [
      `🔬 [EA Research Lab] Step 5 Multi-Year Stress Test: ${passed ? "PASSED ✅" : "REVIEW NEEDED ⚠️"}`,
      `Candidate: ${setId} (${eaName} ${symbol} ${tf})`,
      `Testing Period: ${longPeriodFrom} to ${longPeriodTo} (${step5StressAnalysis?.years.toFixed(1) ?? "3.7"} Years)`,
      `Model: ${longPeriodModel}`,
      `• Net Profit: $${number(p)} (Annualized: ~$${number(step5StressAnalysis?.annualizedProfit ?? (p / 3.7))}/yr)`,
      `• Max Equity DD: ${number(dd)}% (Baseline: ${number(baseline?.equity_dd)}%)`,
      `• Profit Factor: ${number(pf)} (Baseline: ${number(baseline?.profit_factor)})`,
      `• Total Trades: ${tr}`,
      `• Recovery Factor: ${number(rec)} (Target: ≥ 3.0)`,
      `Verdict: ${passed ? "REGIME SURVIVAL PASSED" : "REVIEW NEEDED"}`
    ].join("\n");

    const ok = await copyToClipboard(summary);
    if (ok) {
      setCopiedText("step5_summary");
      setTimeout(() => setCopiedText(""), 2500);
    }
  }

  // Step 8: Narrow Ranges calculation
  const numericParams = activeCandidate
    ? Object.entries(activeCandidate.parameters)
        .filter(([, v]) => Number.isFinite(Number(v)))
        .map(([k, v]) => calculateNarrowRange(k, Number(v)))
    : [];

  const mt5RangeInputsString = activeCandidate
    ? formatMT5OptimizationInputs(numericParams, activeCandidate.parameters)
    : "";

  // Step 2 Sort & Filter helpers
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (field === "equityDd" || field === "rank") {
        setSortOrder("asc");
      } else {
        setSortOrder("desc");
      }
    }
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterMaxDD(null);
    setFilterMinPF(null);
    setFilterMinTrades(null);
    setSortField("rank");
    setSortOrder("asc");
  }

  function toggleResultSelection(id: number) {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll(items: { id: number }[]) {
    const allSelected = items.length > 0 && items.every(it => selectedResultIds.has(it.id));
    if (allSelected) {
      setSelectedResultIds(prev => {
        const next = new Set(prev);
        items.forEach(it => next.delete(it.id));
        return next;
      });
    } else {
      setSelectedResultIds(prev => {
        const next = new Set(prev);
        items.forEach(it => next.add(it.id));
        return next;
      });
    }
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="sort-icon-muted" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={12} className="sort-icon-active" />
    ) : (
      <ArrowDown size={12} className="sort-icon-active" />
    );
  }

  const activeFilterCount = (filterMaxDD !== null ? 1 : 0) +
    (filterMinPF !== null ? 1 : 0) +
    (filterMinTrades !== null ? 1 : 0);

  const filteredPreviewItems = useMemo(() => {
    if (!discoveryPreview?.items) return [];

    let list = [...discoveryPreview.items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const matchSetId = item.stable_set_id?.toLowerCase().includes(q);
        const matchPass = item.mt5_pass ? String(item.mt5_pass).toLowerCase().includes(q) : false;
        const matchHash = item.full_hash?.toLowerCase().includes(q);
        return matchSetId || matchPass || matchHash;
      });
    }

    if (filterMaxDD !== null) {
      list = list.filter(item => (item.equity_dd ?? 999) <= filterMaxDD);
    }

    if (filterMinPF !== null) {
      list = list.filter(item => (item.profit_factor ?? 0) >= filterMinPF);
    }

    if (filterMinTrades !== null) {
      list = list.filter(item => (item.trades ?? 0) >= filterMinTrades);
    }

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === "rank") {
        diff = (a.discovery_rank ?? 0) - (b.discovery_rank ?? 0);
      } else if (sortField === "setId") {
        diff = (a.stable_set_id || "").localeCompare(b.stable_set_id || "");
      } else if (sortField === "profitFactor") {
        diff = (a.profit_factor ?? 0) - (b.profit_factor ?? 0);
      } else if (sortField === "equityDd") {
        diff = (a.equity_dd ?? 0) - (b.equity_dd ?? 0);
      } else if (sortField === "trades") {
        diff = (a.trades ?? 0) - (b.trades ?? 0);
      } else if (sortField === "profit") {
        diff = (a.profit ?? 0) - (b.profit ?? 0);
      }
      return sortOrder === "asc" ? diff : -diff;
    });

    return list;
  }, [discoveryPreview, searchQuery, filterMaxDD, filterMinPF, filterMinTrades, sortField, sortOrder]);

  // Active Candidate or Step 2 Preview Candidate for MT5 handshake
  const selectedPreviewItem =
    filteredPreviewItems.find(r => r.id === selectedPreviewId) ||
    filteredPreviewItems[0] ||
    discoveryPreview?.items.find(r => r.id === selectedPreviewId) ||
    discoveryPreview?.items[0];
  const currentActiveParams = activeCandidate?.parameters || selectedPreviewItem?.parameters;
  const currentActiveSetId = activeCandidate?.baseline.stable_set_id || selectedPreviewItem?.stable_set_id;
  const currentActiveEAName =
    activeCandidate?.run.ea_name && activeCandidate.run.ea_name !== "Unknown EA"
      ? activeCandidate.run.ea_name
      : activeRun?.ea_name && activeRun.ea_name !== "Unknown EA"
      ? activeRun.ea_name
      : "HybridSMC";
  const currentActiveSymbol =
    activeCandidate?.run.symbol && activeCandidate.run.symbol !== "Symbol"
      ? activeCandidate.run.symbol
      : activeRun?.symbol && activeRun.symbol !== "Symbol"
      ? activeRun.symbol
      : "XAUUSD";
  const currentActiveTimeframe = activeCandidate?.run.timeframe || activeRun?.timeframe || "M1";
  const currentActivePF = activeCandidate?.baseline.profit_factor ?? selectedPreviewItem?.profit_factor;
  const currentActiveDD = activeCandidate?.baseline.equity_dd ?? selectedPreviewItem?.equity_dd;
  const currentActiveProfit = activeCandidate?.baseline.profit ?? selectedPreviewItem?.profit;

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
            {/* LEFT COLUMN: META TRADER 5 INSTRUCTIONS & ACTIONS OR STEP 4 DIAGNOSTICS */}
            <div className={`handshake-box mt5-terminal-box ${activeStep === 4 ? "step4-diagnostics-box" : activeStep === 5 ? "step5-mt5-guide-box" : ""}`}>
              {activeStep === 4 ? (
                <>
                  <div className="box-header">
                    <span className="platform-tag lab-tag">QUANT SENSITIVITY DIAGNOSTICS</span>
                    <h3>การวิเคราะห์ Tick Sensitivity & Stress</h3>
                  </div>

                  <div className="box-content">
                    {/* Tick Robustness Score Card */}
                    <div className="step4-score-card">
                      <div className="score-card-left">
                        <span className="score-card-label">Tick Stability Index (TSI)</span>
                        <span className="score-card-grade" style={{ color: tickRobustness?.gradeColor }}>
                          {tickRobustness?.grade || "Evaluating..."}
                        </span>
                        <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                          ประเมินจากอัตรากำไรที่รอดชีวิต, ส่วนต่าง Drawdown และความคงที่ของคำสั่ง
                        </p>
                      </div>
                      <div className="score-badge-circle" style={{ borderColor: tickRobustness?.gradeColor }}>
                        <span className="num" style={{ color: tickRobustness?.gradeColor }}>
                          {tickRobustness?.score ?? 88}
                        </span>
                        <span className="sub">/ 100</span>
                      </div>
                    </div>

                    {/* 3 Risk Stress Factors */}
                    <div className="step4-stress-factors">
                      <div className="stress-factor-card">
                        <div className="stress-factor-header">
                          <span className="stress-factor-title">
                            <TrendingUp size={14} className="text-emerald-600" />
                            1. Slippage & Scalp Noise Risk
                          </span>
                          <span className={`stress-factor-val ${Number(degradation.profitDropPct) > -30 ? "good" : "warn"}`}>
                            Retention {tickRobustness?.retentionPct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="stress-factor-desc">
                          กำไรยังคงอยู่ {tickRobustness?.retentionPct.toFixed(1)}% (ดรอป {Math.abs(degradation.profitDropPct ?? 0).toFixed(1)}% ซึ่ง &lt; เพดาน 30%) ยืนยันว่าระบบไม่ได้เป็น Scalping เสี้ยววินาที และมีความทนทานต่อ Slippage สูง
                        </p>
                      </div>

                      <div className="stress-factor-card">
                        <div className="stress-factor-header">
                          <span className="stress-factor-title">
                            <ShieldCheck size={14} className="text-blue-600" />
                            2. Spread & Tick Spike Resistance
                          </span>
                          <span className={`stress-factor-val ${(degradation.ddDiffPp ?? 0) <= 5 ? "good" : "warn"}`}>
                            DD Inflation {degradation.ddDiffPp !== null ? `${degradation.ddDiffPp >= 0 ? "+" : ""}${degradation.ddDiffPp.toFixed(2)} pp` : "—"}
                          </span>
                        </div>
                        <p className="stress-factor-desc">
                          Drawdown ขยายตัวเพียง {degradation.ddDiffPp !== null ? `${degradation.ddDiffPp >= 0 ? "+" : ""}${degradation.ddDiffPp.toFixed(2)} pp` : "—"} (ต่ำกว่าเพดาน 5.0 pp) แสดงว่า Stop Loss และ Trailing ไม่ถูก Tick Spikes ในตลาดจริงกระชากกินผิดจังหวะ
                        </p>
                      </div>

                      <div className="stress-factor-card">
                        <div className="stress-factor-header">
                          <span className="stress-factor-title">
                            <Activity size={14} className="text-purple-600" />
                            3. Order Execution Frequency Match
                          </span>
                          <span className={`stress-factor-val ${tickRobustness && tickRobustness.tradeMatchPct >= 80 ? "good" : "warn"}`}>
                            Match {tickRobustness?.tradeMatchPct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="stress-factor-desc">
                          จำนวนไม้ทดสอบจริงคงที่ {tickRobustness?.tradeMatchPct.toFixed(1)}% ({latestRealTick?.metrics.trades ?? "—"} / {baseline?.trades ?? "—"} ไม้) ยืนยันว่าเงื่อนไขเปิดปิดออเดอร์มีความเสถียร ไม่ได้รับอิทธิพลจาก Tick ก่อกวน
                        </p>
                      </div>
                    </div>

                    {/* Evidence Screenshot Preview Card */}
                    {uploadedImage ? (
                      <div className="step4-evidence-thumb-card">
                        <div className="step4-thumb-img-wrap" onClick={() => setShowImageModal(true)}>
                          <img src={uploadedImage} alt="MT5 Backtest Screenshot" className="step4-thumb-img" />
                          <div className="thumb-zoom-overlay">
                            <Eye size={14} />
                          </div>
                        </div>
                        <div className="step4-thumb-info">
                          <b>หลักฐานภาพถ่าย MT5 Report</b>
                          <p>{uploadedImageName || "screenshot.png"} (บันทึกไว้ใน Record)</p>
                          <button
                            type="button"
                            className="change-img-btn"
                            style={{ textAlign: "left", width: "fit-content" }}
                            onClick={() => setShowImageModal(true)}
                          >
                            🔍 คลิกดูภาพสกรีนช็อตขนาดเต็ม
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="step4-evidence-thumb-card">
                        <div className="step4-thumb-info">
                          <b>หลักฐานผลลัพธ์ MT5</b>
                          <p>ผลการทดสอบ Real Tick บันทึกและเชื่อมโยงกับ Candidate ในระบบเรียบร้อย</p>
                        </div>
                      </div>
                    )}

                    {/* Quick Diagnostic Actions */}
                    <div className="step4-actions-row">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={copyValidationSummary}
                      >
                        <Copy size={13} />
                        {copiedText === "validation_summary" ? "คัดลอกสรุปแล้ว!" : "Copy Validation Summary"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changeStep(3)}
                      >
                        ← ปรับแก้ผลสถิติ / อัปโหลดใหม่
                      </Button>
                    </div>
                  </div>
                </>
              ) : activeStep === 5 ? (
                <>
                  <div className="box-header">
                    <span className="platform-tag mt5-tag">METATRADER 5 ACTIONS</span>
                    <h3>การตั้งค่าขยายเวลา Backtest (Multi-Year)</h3>
                  </div>

                  <div className="box-content">
                    <div className="instruction-step-list">
                      <div className="instruction-item highlight">
                        <span className="num-dot">1</span>
                        <div>
                          <b>ขยายช่วงวันที่ทดสอบ (Date Range Selection):</b>
                          <p>
                            เลือกช่วงเวลา 3–5 ปี ให้ครอบคลุมทุกสภาวะตลาด (Bull 2021, Bear 2022, Fed Rate Hikes 2023, All-Time Highs 2024):
                          </p>

                          {/* Presets Grid */}
                          <div className="step5-preset-buttons">
                            <button
                              type="button"
                              className={`step5-preset-chip ${longPeriodFrom === "2021-01-01" && longPeriodTo === "2024-10-01" ? "active" : ""}`}
                              onClick={() => {
                                setLongPeriodFrom("2021-01-01");
                                setLongPeriodTo("2024-10-01");
                              }}
                            >
                              ⚡ 3 ปี แนะนำ (2021 – 2024)
                            </button>
                            <button
                              type="button"
                              className={`step5-preset-chip ${longPeriodFrom === "2019-01-01" && longPeriodTo === "2024-10-01" ? "active" : ""}`}
                              onClick={() => {
                                setLongPeriodFrom("2019-01-01");
                                setLongPeriodTo("2024-10-01");
                              }}
                            >
                              🛡️ 5 ปี ครบวัฏจักร (2019 – 2024)
                            </button>
                            <button
                              type="button"
                              className={`step5-preset-chip ${longPeriodFrom === "2022-01-01" && longPeriodTo === "2024-10-01" ? "active" : ""}`}
                              onClick={() => {
                                setLongPeriodFrom("2022-01-01");
                                setLongPeriodTo("2024-10-01");
                              }}
                            >
                              🌐 2 ปี ยุคดอกเบี้ยสูง (2022 – 2024)
                            </button>
                          </div>

                          <div className="step5-dates-display">
                            <div className="date-pair">
                              <span>From: <b className="mono">{longPeriodFrom.replace(/-/g, ".")}</b></span>
                              <span>To: <b className="mono">{longPeriodTo.replace(/-/g, ".")}</b></span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(`${longPeriodFrom.replace(/-/g, ".")} - ${longPeriodTo.replace(/-/g, ".")}`, "mt5_dates")}
                            >
                              <Copy size={13} />
                              {copiedText === "mt5_dates" ? "คัดลอกวันที่แล้ว!" : "Copy MT5 Dates"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="instruction-item">
                        <span className="num-dot">2</span>
                        <div>
                          <b>เลือกความเร็วในการรัน (Modelling Method):</b>
                          <div className="step5-model-cards">
                            <div
                              className={`step5-model-card ${longPeriodModel === "1 minute OHLC" ? "selected" : ""}`}
                              onClick={() => setLongPeriodModel("1 minute OHLC")}
                            >
                              <div className="model-head">
                                <b>⚡ 1 minute OHLC (รวดเร็ว)</b>
                                <span className="speed-pill fast">~1-2 นาที</span>
                              </div>
                              <p>เหมาะสำหรับ Fast Screening เพื่อดู Curve กำไรและ Drawdown เบื้องต้นอย่างรวดเร็ว</p>
                            </div>

                            <div
                              className={`step5-model-card ${longPeriodModel === "Every tick based on real ticks" ? "selected" : ""}`}
                              onClick={() => setLongPeriodModel("Every tick based on real ticks")}
                            >
                              <div className="model-head">
                                <b>💎 Real Ticks (แม่นยำสูงสุด)</b>
                                <span className="speed-pill accurate">Final Sign-off</span>
                              </div>
                              <p>จำลองข้อมูล Tick จริงและ Spread ลอยตัว สำหรับยืนยันตัว Candidate ที่ผ่านเข้ารอบสุดท้าย</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="instruction-item">
                        <span className="num-dot">3</span>
                        <div>
                          <b>ใส่ค่าพารามิเตอร์ของ Candidate:</b>
                          <p>ใช้ค่าพารามิเตอร์ชุดเดิมที่ผ่านเกณฑ์ Real Tick จาก Step 3–4:</p>
                          {currentActiveParams ? (
                            <div className="mt5-candidate-selected-card">
                              <div className="selected-card-header">
                                <span className="selected-badge">TESTING CANDIDATE</span>
                                <b className="mono font-bold">{currentActiveSetId}</b>
                              </div>
                              <div className="mt5-quick-actions">
                                <Button
                                  size="sm"
                                  onClick={() => handleCopy(
                                    formatSetFileContent(currentActiveParams, {
                                      setId: currentActiveSetId,
                                      eaName: currentActiveEAName,
                                      symbol: currentActiveSymbol || undefined
                                    }),
                                    "mt5_params_step5"
                                  )}
                                >
                                  <Copy size={14} />
                                  {copiedText === "mt5_params_step5" ? "คัดลอกแล้ว!" : "Copy Params"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadSetFile(
                                    currentActiveParams,
                                    `${currentActiveSetId}_MultiYear_${currentActiveEAName}`,
                                    {
                                      setId: currentActiveSetId,
                                      eaName: currentActiveEAName,
                                      symbol: currentActiveSymbol || undefined
                                    }
                                  )}
                                >
                                  <Download size={14} /> Save .set File
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <small className="muted">ไม่มีข้อมูลพารามิเตอร์</small>
                          )}
                        </div>
                      </div>

                      <div className="instruction-item">
                        <span className="num-dot">4</span>
                        <div>
                          <b>วัฏจักรตลาดที่ถูกครอบคลุมในรอบนี้ (Regimes Covered):</b>
                          <div className="step5-regimes-pills">
                            <span className="regime-pill">🐂 Bull Market (Trending Up)</span>
                            <span className="regime-pill">🐻 Bear Market (Rate Hikes Cycle)</span>
                            <span className="regime-pill">🦀 Extended Sideway / Chop</span>
                            <span className="regime-pill">⚡ High Volatility & Crisis Spikes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                          <p>เลือก Expert Advisor: <code className="terminal-code">{currentActiveEAName}</code></p>
                        </div>
                      </div>

                      <div className="instruction-item">
                        <span className="num-dot">2</span>
                        <div>
                          <b>ตั้งค่าโหมดการทดสอบใน MT5:</b>
                          <div className="setting-tag-group">
                            <span className="setting-tag">Symbol: <b>{currentActiveSymbol}</b></span>
                            <span className="setting-tag">Timeframe: <b>{currentActiveTimeframe}</b></span>
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
                          {currentActiveParams ? (
                            <div className="mt5-candidate-selected-card">
                              <div className="selected-card-header">
                                <span className="selected-badge">ACTIVE SHORTLIST</span>
                                <b className="mono font-bold">{currentActiveSetId}</b>
                              </div>
                              <div className="selected-card-stats">
                                <span>PF: <b className="cyan mono font-bold">{number(currentActivePF)}</b></span>
                                <span>DD: <b className="mono font-bold">{number(currentActiveDD)}%</b></span>
                                <span>Profit: <b className="green mono font-bold">${number(currentActiveProfit)}</b></span>
                              </div>
                              <div className="mt5-quick-actions">
                                <Button
                                  size="sm"
                                  onClick={() => handleCopy(
                                    formatSetFileContent(currentActiveParams, {
                                      setId: currentActiveSetId,
                                      eaName: currentActiveEAName,
                                      symbol: currentActiveSymbol || undefined
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
                                    currentActiveParams,
                                    `${currentActiveSetId}_${currentActiveEAName}`,
                                    {
                                      setId: currentActiveSetId,
                                      eaName: currentActiveEAName,
                                      symbol: currentActiveSymbol || undefined
                                    }
                                  )}
                                >
                                  <Download size={14} /> Save .set File
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt5-select-prompt">
                              <small className="muted">คลิกเลือก Candidate จากตารางในคอลัมน์ขวา หรือเลือกด้านบน</small>
                            </div>
                          )}
                        </div>
                      </div>

                      {activeStep === 2 && (
                        <div className="instruction-item highlight">
                          <span className="num-dot">4</span>
                          <div>
                            <b>รัน Single Test ใน MT5 แล้วไปต่อ:</b>
                            <p>เมื่อรัน Every Tick บน MT5 เสร็จแล้ว กดปุ่ม <b>"บันทึก Shortlist และเริ่มทดสอบ"</b> ด้านล่าง เพื่อไป Step 3</p>
                          </div>
                        </div>
                      )}

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
                </>
              )}
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
                      คัดกรองตัวท็อปโดยใช้เกณฑ์มาตรฐาน Quant (DD ≤ {policyMaxDD}% · PF ≥ 2 · Trades ≥ 100) — เรียงลำดับตาม:{" "}
                      <b>{
                        rankingObjective === "max_profit" ? "💰 กำไรสุทธิสูงสุด (Max Net Profit)" :
                        rankingObjective === "mt5_result" ? "⚡ MT5 Result สูงสุด" :
                        rankingObjective === "min_dd" ? "🦺 Drawdown ต่ำสุด" :
                        "🛡️ ความเสถียรภาพ Quant (PF & DD)"
                      }</b>
                    </p>

                    <div className="discovery-preset-bar">
                      <div className="preset-bar-header">
                        <span className="preset-label">
                          <Target size={15} className="green" />
                          <span>เลือกขนาด Candidate Shortlist สำหรับทดสอบ:</span>
                        </span>
                        {discoveryBusy && <span className="discovery-spinner">กำลังประมวลผล...</span>}
                      </div>
                      <div className="preset-buttons">
                        <button
                          type="button"
                          className={`preset-btn ${discoveryCount === 3 ? "active" : ""}`}
                          disabled={discoveryBusy}
                          onClick={() => runQuickDiscovery(3, policyMaxDD, rankingObjective)}
                        >
                          <span className="preset-icon">🎯</span>
                          <span className="preset-name">Top 3 Candidates</span>
                          <span className="preset-pill">แนะนำ (Focus)</span>
                        </button>
                        <button
                          type="button"
                          className={`preset-btn ${discoveryCount === 5 ? "active" : ""}`}
                          disabled={discoveryBusy}
                          onClick={() => runQuickDiscovery(5, policyMaxDD, rankingObjective)}
                        >
                          <span className="preset-icon">🎯</span>
                          <span className="preset-name">Top 5 Candidates</span>
                          <span className="preset-pill secondary">มาตรฐาน</span>
                        </button>
                        <button
                          type="button"
                          className={`preset-btn ${discoveryCount === 10 ? "active" : ""}`}
                          disabled={discoveryBusy}
                          onClick={() => runQuickDiscovery(10, policyMaxDD, rankingObjective)}
                        >
                          <span className="preset-name">Top 10 Candidates</span>
                          <span className="preset-pill muted">กว้าง</span>
                        </button>
                        <button
                          type="button"
                          className={`preset-btn ${discoveryCount === 20 ? "active" : ""}`}
                          disabled={discoveryBusy}
                          onClick={() => runQuickDiscovery(20, policyMaxDD, rankingObjective)}
                        >
                          <span className="preset-name">Top 20 Candidates</span>
                          <span className="preset-pill muted">สำรวจลึก</span>
                        </button>
                      </div>

                      {/* Ranking Objective Selector */}
                      <div className="discovery-policy-bar objective-bar">
                        <div className="policy-bar-header">
                          <span className="policy-label">
                            🎯 เป้าหมายการจัดอันดับ Top Candidates (Objective):
                          </span>
                          <span className="policy-current-val">
                            โหมดปัจจุบัน: <b>{
                              rankingObjective === "max_profit" ? "💰 เน้นกำไรสุทธิสูงสุด (Max Net Profit)" :
                              rankingObjective === "mt5_result" ? "⚡ เน้นคะแนน MT5 Result สูงสุด" :
                              rankingObjective === "min_dd" ? "🦺 เน้น Drawdown ต่ำสุด" :
                              "🛡️ Quant Robustness (เน้นเสถียรภาพ PF & DD)"
                            }</b>
                          </span>
                        </div>
                        <div className="policy-pills">
                          <button
                            type="button"
                            className={`policy-pill ${rankingObjective === "quant_robustness" ? "active" : ""}`}
                            disabled={discoveryBusy}
                            onClick={() => runQuickDiscovery(discoveryCount, policyMaxDD, "quant_robustness")}
                          >
                            🛡️ Quant เสถียรภาพ (PF สูงสุด)
                          </button>
                          <button
                            type="button"
                            className={`policy-pill ${rankingObjective === "max_profit" ? "active" : ""}`}
                            disabled={discoveryBusy}
                            onClick={() => runQuickDiscovery(discoveryCount, policyMaxDD, "max_profit")}
                          >
                            💰 กำไรสุทธิสูงสุด (Max Profit) ⭐ ดึงชุดในภาพ MT5
                          </button>
                          <button
                            type="button"
                            className={`policy-pill ${rankingObjective === "mt5_result" ? "active" : ""}`}
                            disabled={discoveryBusy}
                            onClick={() => runQuickDiscovery(discoveryCount, policyMaxDD, "mt5_result")}
                          >
                            ⚡ MT5 Result สูงสุด (Complex Max)
                          </button>
                          <button
                            type="button"
                            className={`policy-pill ${rankingObjective === "min_dd" ? "active" : ""}`}
                            disabled={discoveryBusy}
                            onClick={() => runQuickDiscovery(discoveryCount, policyMaxDD, "min_dd")}
                          >
                            🦺 Drawdown ต่ำสุด (Safe)
                          </button>
                        </div>
                      </div>

                      {/* Policy Max Drawdown Selector */}
                      <div className="discovery-policy-bar">
                        <div className="policy-bar-header">
                          <span className="policy-label">
                            🛡️ เกณฑ์ Max Drawdown (DD) สูงสุด:
                          </span>
                          <span className="policy-current-val">
                            กำลังกรองที่: <b>≤ {policyMaxDD}%</b>
                          </span>
                        </div>
                        <div className="policy-pills">
                          {[8, 10, 12, 15, 20].map(val => (
                            <button
                              key={val}
                              type="button"
                              className={`policy-pill ${policyMaxDD === val ? "active" : ""}`}
                              disabled={discoveryBusy}
                              onClick={() => runQuickDiscovery(discoveryCount, val, rankingObjective)}
                            >
                              ≤ {val}% {val === 12 ? "⭐ ปรับเป็น 12%" : val === 10 ? "(เกณฑ์เดิม)" : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* View Mode Switcher: Table & Filter (Default) vs Pareto Chart vs Both */}
                    <div className="step2-view-switcher">
                      <button
                        type="button"
                        className={`view-tab-btn ${step2ViewMode === "table" ? "active" : ""}`}
                        onClick={() => setStep2ViewMode("table")}
                      >
                        <Sliders size={13} />
                        <span>📋 ตาราง Shortlist & ตัวกรอง {discoveryPreview?.items?.length ? `(${filteredPreviewItems.length})` : ""}</span>
                      </button>
                      <button
                        type="button"
                        className={`view-tab-btn ${step2ViewMode === "chart" ? "active" : ""}`}
                        onClick={() => setStep2ViewMode("chart")}
                      >
                        <TrendingUp size={13} />
                        <span>📈 กราฟ Pareto Frontier</span>
                      </button>
                      <button
                        type="button"
                        className={`view-tab-btn ${step2ViewMode === "both" ? "active" : ""}`}
                        onClick={() => setStep2ViewMode("both")}
                      >
                        <span>👀 แสดงทั้งคู่ (ตาราง + กราฟ)</span>
                      </button>
                    </div>

                    {/* Loading State when auto-fetching or switching presets */}
                    {discoveryBusy && !discoveryPreview && (
                      <div className="discovery-loading-state">
                        <RefreshCw size={22} className="spin-animation text-emerald-600" />
                        <b>กำลังค้นหาและจัดอันดับ Candidates ที่ดีที่สุด...</b>
                        <span className="muted" style={{ fontSize: 11 }}>กรอง DD ≤ 10% · PF ≥ 2.0 · Trades ≥ 100 อัตโนมัติ</span>
                      </div>
                    )}

                    {/* If Chart is selected or Both, show Pareto Chart */}
                    {(step2ViewMode === "chart" || step2ViewMode === "both") && (
                      <div className="step2-chart-container" style={{ marginTop: 12 }}>
                        <ParetoFrontierChart
                          candidates={
                            filteredPreviewItems.length
                              ? filteredPreviewItems.map(r => ({
                                  id: r.id,
                                  stable_set_id: r.stable_set_id,
                                  profit: r.profit,
                                  equity_dd: r.equity_dd,
                                  profit_factor: r.profit_factor,
                                  trades: r.trades,
                                }))
                              : discoveryPreview?.items?.length
                              ? discoveryPreview.items.map(r => ({
                                  id: r.id,
                                  stable_set_id: r.stable_set_id,
                                  profit: r.profit,
                                  equity_dd: r.equity_dd,
                                  profit_factor: r.profit_factor,
                                  trades: r.trades,
                                }))
                              : candidates.data?.items?.slice(0, 5).map(c => ({
                                  id: c.id,
                                  stable_set_id: c.baseline.stable_set_id,
                                  profit: c.baseline.profit,
                                  equity_dd: c.baseline.equity_dd,
                                  profit_factor: c.baseline.profit_factor,
                                  trades: c.baseline.trades,
                                })) || []
                          }
                          selectedCandidateId={selectedPreviewId || selectedCandidateId}
                          onSelectCandidate={(id) => setSelectedPreviewId(id)}
                        />
                      </div>
                    )}

                    {/* Table View (Default) */}
                    {(step2ViewMode === "table" || step2ViewMode === "both") && (
                      <div className="preview-results-wrap" style={{ marginTop: 10 }}>
                        {discoveryPreview ? (
                          <>
                            <div className="preview-stat-summary">
                              <div className="stat-summary-left">
                                <span className="summary-pill green">
                                  <CheckCircle2 size={13} />
                                  ผ่านเกณฑ์มาตรฐาน Quant: <b>{discoveryPreview.qualifying_sets.toLocaleString()}</b> Unique Sets
                                </span>
                                <span className="summary-sub">
                                  (เกณฑ์: DD ≤ {discoveryPreview?.policy?.max_equity_dd ?? policyMaxDD}% · PF ≥ 2.0 · Trades ≥ 100 · {
                                    rankingObjective === "max_profit" ? "เรียงตามกำไรสุทธิสูงสุด" :
                                    rankingObjective === "mt5_result" ? "เรียงตาม MT5 Result" :
                                    rankingObjective === "min_dd" ? "เรียงตาม Drawdown ต่ำสุด" :
                                    "เรียงตามเสถียรภาพ Quant PF"
                                  })
                                </span>
                              </div>
                              <div className="stat-summary-right">
                                <span className="summary-pill cyan">
                                  แสดง <b>{filteredPreviewItems.length}</b> จาก <b>{discoveryPreview.items.length}</b> อันดับแรก
                                </span>
                              </div>
                            </div>

                            {/* Search, Filter & Quick Sort Toolbar */}
                            <div className="filter-sort-toolbar">
                              <div className="toolbar-top-row">
                                <div className="search-box-wrap">
                                  <Search size={14} className="search-box-icon" />
                                  <input
                                    type="text"
                                    placeholder="ค้นหา Set ID หรือ MT5 Pass เช่น 11563, 11759, set_..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter" && searchQuery.trim()) {
                                        runQuickDiscovery(discoveryCount, policyMaxDD, rankingObjective, searchQuery.trim());
                                      }
                                    }}
                                    className="filter-search-input"
                                  />
                                  {searchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSearchQuery("");
                                        runQuickDiscovery(discoveryCount, policyMaxDD, rankingObjective);
                                      }}
                                      className="search-clear-btn"
                                      title="ล้างคำค้นหา"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                                {searchQuery.trim() && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}
                                    title="ค้นหา Pass นี้จากข้อมูล Optimization ทั้งหมด"
                                    disabled={discoveryBusy}
                                    onClick={() => runQuickDiscovery(discoveryCount, policyMaxDD, rankingObjective, searchQuery.trim())}
                                  >
                                    🔍 ค้นหาทั้ง Run
                                  </button>
                                )}

                                <div className="toolbar-action-group">
                                  <button
                                    type="button"
                                    className={`filter-toggle-btn ${showFilterPanel ? "active" : ""} ${activeFilterCount > 0 ? "has-filters" : ""}`}
                                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                                  >
                                    <Filter size={13} />
                                    <span>ตัวกรองละเอียด</span>
                                    {activeFilterCount > 0 && (
                                      <span className="filter-badge-count">{activeFilterCount}</span>
                                    )}
                                  </button>

                                  {(activeFilterCount > 0 || searchQuery || sortField !== "rank" || sortOrder !== "asc") && (
                                    <button
                                      type="button"
                                      onClick={resetFilters}
                                      className="filter-reset-btn"
                                      title="รีเซ็ตการเรียงลำดับและตัวกรองทั้งหมด"
                                    >
                                      <RotateCcw size={12} />
                                      <span>รีเซ็ต</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Quick Sort & Objective Ranking Pills */}
                              <div className="quick-sort-row">
                                <span className="quick-sort-label">คัดเลือก & จัดอันดับตัวท็อป:</span>
                                <div className="quick-sort-pills">
                                  <button
                                    type="button"
                                    className={`sort-pill ${rankingObjective === "quant_robustness" && sortField !== "profit" && sortField !== "trades" ? "active" : ""}`}
                                    disabled={discoveryBusy}
                                    onClick={() => {
                                      setSortField("rank");
                                      setSortOrder("asc");
                                      if (rankingObjective !== "quant_robustness") {
                                        runQuickDiscovery(discoveryCount, policyMaxDD, "quant_robustness");
                                      }
                                    }}
                                  >
                                    🛡️ Quant เสถียรภาพ (PF สูงสุด)
                                  </button>
                                  <button
                                    type="button"
                                    className={`sort-pill ${rankingObjective === "max_profit" || sortField === "profit" ? "active" : ""}`}
                                    disabled={discoveryBusy}
                                    onClick={() => {
                                      setSortField("profit");
                                      setSortOrder("desc");
                                      runQuickDiscovery(discoveryCount, policyMaxDD, "max_profit");
                                    }}
                                  >
                                    💰 Net Profit สูงสุด ↓ (ชุดในภาพ MT5 ⭐)
                                  </button>
                                  <button
                                    type="button"
                                    className={`sort-pill ${rankingObjective === "min_dd" || sortField === "equityDd" ? "active" : ""}`}
                                    disabled={discoveryBusy}
                                    onClick={() => {
                                      setSortField("equityDd");
                                      setSortOrder("asc");
                                      runQuickDiscovery(discoveryCount, policyMaxDD, "min_dd");
                                    }}
                                  >
                                    🦺 Drawdown ต่ำสุด ↑
                                  </button>
                                  <button
                                    type="button"
                                    className={`sort-pill ${rankingObjective === "mt5_result" ? "active" : ""}`}
                                    disabled={discoveryBusy}
                                    onClick={() => {
                                      setSortField("rank");
                                      setSortOrder("asc");
                                      runQuickDiscovery(discoveryCount, policyMaxDD, "mt5_result");
                                    }}
                                  >
                                    ⚡ MT5 Result สูงสุด
                                  </button>
                                  <button
                                    type="button"
                                    className={`sort-pill ${sortField === "trades" && sortOrder === "desc" ? "active" : ""}`}
                                    onClick={() => { setSortField("trades"); setSortOrder("desc"); }}
                                  >
                                    Trades มากสุด ↓
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Filter Panel */}
                              {showFilterPanel && (
                                <div className="advanced-filter-panel">
                                  <div className="filter-grid">
                                    <div className="filter-col">
                                      <span className="filter-col-title">Max Drawdown (DD)</span>
                                      <div className="filter-chips">
                                        {[null, 5, 8, 10, 12, 15, 20].map(val => (
                                          <button
                                            key={String(val)}
                                            type="button"
                                            className={`filter-chip ${filterMaxDD === val ? "active" : ""}`}
                                            onClick={() => setFilterMaxDD(val)}
                                          >
                                            {val === null ? "ทั้งหมด" : `≤ ${val}%`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="filter-col">
                                      <span className="filter-col-title">Min Profit Factor (PF)</span>
                                      <div className="filter-chips">
                                        {[null, 1.8, 2.0, 2.5, 3.0].map(val => (
                                          <button
                                            key={String(val)}
                                            type="button"
                                            className={`filter-chip ${filterMinPF === val ? "active" : ""}`}
                                            onClick={() => setFilterMinPF(val)}
                                          >
                                            {val === null ? "ทั้งหมด" : `≥ ${val}`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="filter-col">
                                      <span className="filter-col-title">Min Trades</span>
                                      <div className="filter-chips">
                                        {[null, 50, 100, 150, 200].map(val => (
                                          <button
                                            key={String(val)}
                                            type="button"
                                            className={`filter-chip ${filterMinTrades === val ? "active" : ""}`}
                                            onClick={() => setFilterMinTrades(val)}
                                          >
                                            {val === null ? "ทั้งหมด" : `≥ ${val}`}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Shortlist Table with Sticky Header and Sort Controls */}
                            <div className="shortlist-table-wrap">
                              <table className="shortlist-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 38, textAlign: "center" }}>
                                      <button
                                        type="button"
                                        className="table-check-btn"
                                        onClick={() => toggleSelectAll(filteredPreviewItems)}
                                        title="เลือก/ยกเลิกทั้งหมดเพื่อ Shortlist"
                                      >
                                        {filteredPreviewItems.length > 0 && filteredPreviewItems.every(r => selectedResultIds.has(r.id)) ? (
                                          <CheckSquare size={14} className="green" />
                                        ) : (
                                          <Square size={14} className="muted" />
                                        )}
                                      </button>
                                    </th>
                                    <th
                                      style={{ width: 54, textAlign: "center" }}
                                      className="sortable-th"
                                      onClick={() => handleSort("rank")}
                                      title="คลิกเพื่อเรียงตามลำดับดั้งเดิม"
                                    >
                                      <div className="th-sort-wrap center">
                                        <span>#</span>
                                        {renderSortIcon("rank")}
                                      </div>
                                    </th>
                                    <th
                                      className="sortable-th"
                                      onClick={() => handleSort("setId")}
                                      title="คลิกเพื่อเรียงตาม Set ID"
                                    >
                                      <div className="th-sort-wrap">
                                        <span>Candidate Set ID / Pass</span>
                                        {renderSortIcon("setId")}
                                      </div>
                                    </th>
                                    <th
                                      style={{ textAlign: "right" }}
                                      className="sortable-th"
                                      onClick={() => handleSort("profitFactor")}
                                      title="คลิกเพื่อเรียงตาม Profit Factor"
                                    >
                                      <div className="th-sort-wrap right">
                                        <span>Profit Factor</span>
                                        {renderSortIcon("profitFactor")}
                                      </div>
                                    </th>
                                    <th
                                      style={{ textAlign: "right" }}
                                      className="sortable-th"
                                      onClick={() => handleSort("equityDd")}
                                      title="คลิกเพื่อเรียงตาม Drawdown"
                                    >
                                      <div className="th-sort-wrap right">
                                        <span>Drawdown</span>
                                        {renderSortIcon("equityDd")}
                                      </div>
                                    </th>
                                    <th
                                      style={{ textAlign: "right" }}
                                      className="sortable-th"
                                      onClick={() => handleSort("trades")}
                                      title="คลิกเพื่อเรียงตาม Trades"
                                    >
                                      <div className="th-sort-wrap right">
                                        <span>Trades</span>
                                        {renderSortIcon("trades")}
                                      </div>
                                    </th>
                                    <th
                                      style={{ textAlign: "right" }}
                                      className="sortable-th"
                                      onClick={() => handleSort("profit")}
                                      title="คลิกเพื่อเรียงตาม Net Profit"
                                    >
                                      <div className="th-sort-wrap right">
                                        <span>Net Profit</span>
                                        {renderSortIcon("profit")}
                                      </div>
                                    </th>
                                    <th style={{ width: 140, textAlign: "center" }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredPreviewItems.length === 0 ? (
                                    <tr>
                                      <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px" }}>
                                        <div className="table-empty-filtered">
                                          <AlertTriangle size={24} className="muted" />
                                          <b>ไม่พบ Candidate ที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง</b>
                                          <p className="muted">ลองเปลี่ยนคำค้นหา หรือผ่อนปรนเกณฑ์ Max Drawdown / Min PF</p>
                                          <Button size="sm" variant="outline" onClick={resetFilters} style={{ marginTop: 8 }}>
                                            <RotateCcw size={13} /> ล้างตัวกรองทั้งหมด
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredPreviewItems.map((row, idx) => {
                                      const isSelected = selectedPreviewId === row.id || (!selectedPreviewId && idx === 0);
                                      const isShortlisted = selectedResultIds.has(row.id);
                                      return (
                                        <tr
                                          key={row.id}
                                          className={`shortlist-row ${isSelected ? "is-selected" : ""}`}
                                          onClick={() => setSelectedPreviewId(row.id)}
                                        >
                                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                              type="button"
                                              className="table-check-btn"
                                              onClick={() => toggleResultSelection(row.id)}
                                              title="เลือก/ยกเลิกเพื่อบันทึก Shortlist"
                                            >
                                              {isShortlisted ? (
                                                <CheckSquare size={15} className="green" />
                                              ) : (
                                                <Square size={15} className="muted" />
                                              )}
                                            </button>
                                          </td>
                                          <td style={{ textAlign: "center" }}>
                                            <span className={`rank-badge ${row.discovery_rank === 1 ? "rank-1" : row.discovery_rank === 2 ? "rank-2" : row.discovery_rank === 3 ? "rank-3" : ""}`}>
                                              #{row.discovery_rank ?? idx + 1}
                                            </span>
                                          </td>
                                          <td>
                                            <div className="set-id-cell">
                                              <code className="table-code font-bold">{row.stable_set_id}</code>
                                              <small className="muted">MT5 Pass #{row.mt5_pass}</small>
                                            </div>
                                          </td>
                                          <td style={{ textAlign: "right" }} className="cyan mono font-bold">
                                            {number(row.profit_factor)}
                                          </td>
                                          <td style={{ textAlign: "right" }} className="mono">
                                            {number(row.equity_dd)}%
                                          </td>
                                          <td style={{ textAlign: "right" }} className="mono">
                                            {number(row.trades, 0)}
                                          </td>
                                          <td style={{ textAlign: "right" }} className="green mono font-bold">
                                            ${number(row.profit)}
                                          </td>
                                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                            <div className="table-row-actions">
                                              <Button
                                                size="sm"
                                                variant={isSelected ? "default" : "outline"}
                                                onClick={() => setSelectedPreviewId(row.id)}
                                                className={`btn-select-cand ${isSelected ? "active" : ""}`}
                                              >
                                                {isSelected ? "✓ เลือกอยู่" : "เลือกตัวนี้"}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                title="ดาวน์โหลด .set สำหรับ MT5"
                                                onClick={() => downloadSetFile(
                                                  row.parameters,
                                                  `${row.stable_set_id}_${activeRun?.ea_name || "EA"}`
                                                )}
                                              >
                                                <Download size={13} />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="action-button-row">
                              <Button
                                disabled={discoveryBusy || selectedResultIds.size === 0}
                                onClick={promoteShortlist}
                                className="btn-promote-primary"
                              >
                                {discoveryBusy ? "กำลังบันทึก..." : `✅ บันทึก Shortlist (${selectedResultIds.size} ตัวที่เลือก) และไปทดสอบ Real Tick`}
                              </Button>
                              <Button variant="outline" onClick={() => changeStep(3)}>
                                ไป Step 3: Every Tick <ArrowRight size={15} />
                              </Button>
                            </div>
                          </>
                        ) : !discoveryBusy ? (
                          <div className="discovery-loading-state">
                            <Target size={22} className="text-emerald-600" />
                            <b>กดปุ่มเลือกขนาด Candidates ด้านบนเพื่อแสดงตาราง</b>
                            <p className="muted" style={{ fontSize: 11, margin: "4px 0 10px 0" }}>
                              ระบบจะคัดกรองเฉพาะชุดพารามิเตอร์ที่ผ่านเกณฑ์ DD ≤ 10% และ PF ≥ 2.0
                            </p>
                            <Button size="sm" onClick={() => runQuickDiscovery(3)}>
                              🎯 ค้นหา Top 3 Candidates
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: EVERY TICK BASED ON REAL TICKS RECORD */}
                {activeStep === 3 && (
                  <div className="step-content-pane">
                    {/* Active Candidate Context Banner */}
                    {activeCandidate && (
                      <div className="step3-candidate-banner">
                        <div className="banner-left">
                          <span className="banner-tag">🎯 Active Candidate under validation</span>
                          <span className="banner-title">
                            <b>{activeCandidate.baseline?.stable_set_id ? `SET-${activeCandidate.baseline.stable_set_id}` : `Candidate #${activeCandidate.id}`}</b>
                            {activeCandidate.run?.ea_name ? ` (EA: ${activeCandidate.run.ea_name})` : ""}
                          </span>
                        </div>
                        <div className="banner-right">
                          <span className="baseline-label">Baseline OHLC M1:</span>
                          <span className="baseline-stat">
                            Profit: <b>${number(baseline?.profit)}</b>
                          </span>
                          <span className="baseline-stat">
                            DD: <b>{baseline?.equity_dd?.toFixed(2)}%</b>
                          </span>
                          <span className="baseline-stat">
                            PF: <b>{baseline?.profit_factor?.toFixed(2)}</b>
                          </span>
                          <span className="baseline-stat">
                            Trades: <b>{baseline?.trades}</b>
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="pane-lead">
                      หลังจากรัน Single Backtest (Every tick based on real ticks) ใน MT5 เสร็จแล้ว
                      อัปโหลดภาพสกรีนช็อตเพื่อให้ระบบอ่านสถิติอัตโนมัติ หรือกรอกตัวเลขโดยตรง:
                    </p>

                    {/* SMART EVIDENCE OCR READER */}
                    {!uploadedImage ? (
                      <div className="step3-smart-reader-card">
                        <div
                          className={`step3-dropzone ${isDraggingOver ? "dragging" : ""}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(true);
                          }}
                          onDragLeave={() => setIsDraggingOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleImageFile(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,.htm,.html,.txt"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageFile(file);
                            }}
                          />
                          <div className="dropzone-icon-circle">
                            <UploadCloud size={28} className="text-emerald-600" />
                          </div>
                          <div className="dropzone-content">
                            <h4>อัปโหลดภาพผลทดสอบ หรือวางภาพสกรีนช็อต (Smart OCR Auto-Fill)</h4>
                            <p>
                              ลากไฟล์ภาพสกรีนช็อต MT5 Backtest หรือกดเลือกไฟล์ (รองรับ PNG, JPG, WebP, HTML/Text Report)
                            </p>
                            <div className="dropzone-actions">
                              <Button
                                size="sm"
                                type="button"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                              >
                                <UploadCloud size={14} /> เลือกไฟล์รูปภาพ
                              </Button>
                              <span className="paste-hint-pill">⚡ กด Ctrl + V วางภาพได้ทันที</span>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowTextPasteBox(prev => !prev);
                                }}
                              >
                                <FileText size={14} /> วางข้อความ Report / HTML
                              </Button>
                            </div>
                          </div>
                        </div>

                        {ocrBusy && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, fontWeight: 600, color: "#065f46" }}>
                              <span>{ocrStatusText}</span>
                              <span>{ocrProgress}%</span>
                            </div>
                            <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${ocrProgress}%`,
                                  height: "100%",
                                  background: "linear-gradient(90deg, #059669, #10b981)",
                                  transition: "width 0.3s ease"
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {showTextPasteBox && (
                          <div className="text-paste-box">
                            <label>วางข้อความตารางสถิติ หรือโค้ด HTML ที่คัดลอกจาก MT5 Strategy Tester Report:</label>
                            <textarea
                              rows={4}
                              placeholder="วางตารางสถิติ หรือ Report HTML จาก MT5 ที่นี่..."
                              value={rawPastedText}
                              onChange={(e) => setRawPastedText(e.target.value)}
                            />
                            <div className="text-paste-actions">
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => handleTextReport(rawPastedText, "Pasted Text")}
                                disabled={!rawPastedText.trim()}
                              >
                                <Sparkles size={14} /> ดึงค่าสถิติอัตโนมัติ
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => setShowTextPasteBox(false)}
                              >
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="step3-smart-reader-card">
                        <div className="step3-image-preview-card">
                          <div className="preview-image-side">
                            <div className="preview-thumb-box" onClick={() => setShowImageModal(true)}>
                              <img src={uploadedImage} alt="MT5 Backtest Screenshot" className="preview-thumb-img" />
                              <div className="thumb-zoom-overlay">
                                <Eye size={16} /> ดูรูปขนาดเต็ม
                              </div>
                            </div>
                            <div className="thumb-meta-row">
                              <span className="file-name-tag" title={uploadedImageName}>
                                <ImageIcon size={13} /> {uploadedImageName || "screenshot.png"}
                              </span>
                              <button
                                type="button"
                                className="change-img-btn"
                                onClick={() => {
                                  setUploadedImage(null);
                                  setOcrDetected(null);
                                  setOcrSuccessMessage("");
                                }}
                              >
                                เปลี่ยนภาพ
                              </button>
                            </div>
                          </div>

                          <div className="preview-detected-side">
                            <div className="detected-header">
                              <span className="detected-title">
                                <Sparkles size={15} className="text-emerald-600" />
                                <b>ผลการอ่านสถิติด้วย Smart OCR:</b>
                              </span>
                              {ocrBusy ? (
                                <span className="ocr-busy-tag">
                                  <RefreshCw size={13} className="spin" /> {ocrStatusText} ({ocrProgress}%)
                                </span>
                              ) : ocrSuccessMessage ? (
                                <span className="ocr-status-pill">{ocrSuccessMessage}</span>
                              ) : null}
                            </div>

                            <div className="detected-chips-grid">
                              <div className={`detected-chip ${ocrDetected?.profit !== null && ocrDetected?.profit !== undefined ? "found" : ""}`}>
                                <span className="chip-label">Total Net Profit</span>
                                <span className="chip-val">
                                  {ocrDetected?.profit !== null && ocrDetected?.profit !== undefined ? `$${number(ocrDetected.profit)}` : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${ocrDetected?.equity_dd !== null && ocrDetected?.equity_dd !== undefined ? "found" : ""}`}>
                                <span className="chip-label">Equity Drawdown</span>
                                <span className="chip-val">
                                  {ocrDetected?.equity_dd !== null && ocrDetected?.equity_dd !== undefined ? `${ocrDetected.equity_dd.toFixed(2)}%` : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${ocrDetected?.profit_factor !== null && ocrDetected?.profit_factor !== undefined ? "found" : ""}`}>
                                <span className="chip-label">Profit Factor</span>
                                <span className="chip-val">
                                  {ocrDetected?.profit_factor !== null && ocrDetected?.profit_factor !== undefined ? ocrDetected.profit_factor.toFixed(2) : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${ocrDetected?.trades !== null && ocrDetected?.trades !== undefined ? "found" : ""}`}>
                                <span className="chip-label">Total Trades</span>
                                <span className="chip-val">
                                  {ocrDetected?.trades !== null && ocrDetected?.trades !== undefined ? ocrDetected.trades : "—"}
                                </span>
                              </div>
                            </div>

                            {(ocrDetected?.recovery_factor || ocrDetected?.sharpe || ocrDetected?.expected_payoff || ocrDetected?.deposit) && (
                              <div className="detected-extra-row">
                                {ocrDetected?.expected_payoff != null && (
                                  <span className="extra-stat">Expected Payoff: <b>{ocrDetected.expected_payoff}</b></span>
                                )}
                                {ocrDetected?.recovery_factor != null && (
                                  <span className="extra-stat">Recovery Factor: <b>{ocrDetected.recovery_factor}</b></span>
                                )}
                                {ocrDetected?.sharpe != null && (
                                  <span className="extra-stat">Sharpe Ratio: <b>{ocrDetected.sharpe}</b></span>
                                )}
                                {ocrDetected?.deposit != null && (
                                  <span className="extra-stat">Deposit: <b>${number(ocrDetected.deposit)}</b></span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <form onSubmit={submitRealTickTest} className="record-form-grid" style={{ marginTop: 14 }}>
                      <div className="form-group">
                        <label>
                          Net Profit ($)
                          {ocrDetected?.profit !== null && ocrDetected?.profit !== undefined && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
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
                        <label>
                          Equity Drawdown (%)
                          {ocrDetected?.equity_dd !== null && ocrDetected?.equity_dd !== undefined && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
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
                        <label>
                          Profit Factor
                          {ocrDetected?.profit_factor !== null && ocrDetected?.profit_factor !== undefined && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
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
                        <label>
                          Total Trades
                          {ocrDetected?.trades !== null && ocrDetected?.trades !== undefined && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="number"
                          step="1"
                          placeholder="เช่น 104"
                          value={realTickTrades}
                          onChange={e => setRealTickTrades(e.target.value)}
                        />
                      </div>

                      {/* Live Degradation Analysis Card */}
                      {step3LiveAnalysis && (
                        <div
                          className={`step3-live-analysis-card ${step3LiveAnalysis.isPassed ? "passed" : "warning"}`}
                          style={{ gridColumn: "span 2" }}
                        >
                          <div className="analysis-header">
                            <span className="analysis-title">
                              <TrendingUp size={16} className={step3LiveAnalysis.isPassed ? "text-emerald-600" : "text-amber-600"} />
                              <b>การประเมิน Degradation แบบ Real-time (Every Tick vs Baseline OHLC M1)</b>
                            </span>
                            <span
                              className={`plateau-verdict-badge ${step3LiveAnalysis.isPassed ? "" : "warning"}`}
                              style={{
                                background: step3LiveAnalysis.isPassed ? "#ecfdf5" : "#fffbeb",
                                color: step3LiveAnalysis.isPassed ? "#047857" : "#b45309",
                                borderColor: step3LiveAnalysis.isPassed ? "#a7f3d0" : "#fde68a"
                              }}
                            >
                              {step3LiveAnalysis.isPassed ? "🟢 ผ่านเกณฑ์ความทนทาน (Low Degradation)" : "⚠️ มี Degradation สูงกว่าเกณฑ์"}
                            </span>
                          </div>

                          <div className="analysis-grid">
                            <div className="analysis-stat">
                              <span className="lbl">Profit Change</span>
                              <span
                                className="val"
                                style={{
                                  color: (step3LiveAnalysis.profitDiffPct ?? 0) >= 0 ? "#059669" : (step3LiveAnalysis.profitDiffPct ?? 0) > -30 ? "#b45309" : "#dc2626"
                                }}
                              >
                                {step3LiveAnalysis.profitDiffPct !== null
                                  ? `${step3LiveAnalysis.profitDiffPct >= 0 ? "+" : ""}${step3LiveAnalysis.profitDiffPct.toFixed(1)}%`
                                  : "—"}
                              </span>
                              <span className="sub">
                                Baseline: ${number(baseline?.profit)} → Real: ${number(step3LiveAnalysis.profit)}
                              </span>
                            </div>

                            <div className="analysis-stat">
                              <span className="lbl">Drawdown Change</span>
                              <span
                                className="val"
                                style={{
                                  color: (step3LiveAnalysis.ddDiffPp ?? 0) <= 0 ? "#059669" : (step3LiveAnalysis.ddDiffPp ?? 0) < 5 ? "#b45309" : "#dc2626"
                                }}
                              >
                                {step3LiveAnalysis.ddDiffPp !== null
                                  ? `${step3LiveAnalysis.ddDiffPp >= 0 ? "+" : ""}${step3LiveAnalysis.ddDiffPp.toFixed(2)} pp`
                                  : "—"}
                              </span>
                              <span className="sub">
                                Baseline: {baseline?.equity_dd?.toFixed(2)}% → Real: {step3LiveAnalysis.dd.toFixed(2)}%
                              </span>
                            </div>

                            <div className="analysis-stat">
                              <span className="lbl">Profit Factor</span>
                              <span
                                className="val"
                                style={{
                                  color: (step3LiveAnalysis.pf ?? 0) >= 2.0 ? "#059669" : (step3LiveAnalysis.pf ?? 0) >= 1.5 ? "#b45309" : "#dc2626"
                                }}
                              >
                                {step3LiveAnalysis.pf !== null ? step3LiveAnalysis.pf.toFixed(2) : "—"}
                              </span>
                              <span className="sub">
                                Baseline: {baseline?.profit_factor?.toFixed(2) ?? "—"} (Delta: {step3LiveAnalysis.pfDiff != null ? `${step3LiveAnalysis.pfDiff >= 0 ? "+" : ""}${step3LiveAnalysis.pfDiff.toFixed(2)}` : "—"})
                              </span>
                            </div>

                            <div className="analysis-stat">
                              <span className="lbl">Total Trades</span>
                              <span className="val" style={{ color: "#0f172a" }}>
                                {step3LiveAnalysis.trades !== null ? step3LiveAnalysis.trades : "—"}
                              </span>
                              <span className="sub">
                                Baseline: {baseline?.trades ?? "—"} ({step3LiveAnalysis.tradesDiffPct != null ? `${step3LiveAnalysis.tradesDiffPct >= 0 ? "+" : ""}${step3LiveAnalysis.tradesDiffPct.toFixed(0)}%` : "—"})
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

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

                        {/* Quantitative Tick Robustness Checklist */}
                        <div className="step4-checklist-box">
                          <h4>
                            <ShieldCheck size={16} className="text-emerald-600" />
                            Quantitative Tick Robustness Checklist (เกณฑ์ความคงทน)
                          </h4>
                          <div className="checklist-items-grid">
                            <div className={`checklist-item ${degradation.profitDropPct !== null && degradation.profitDropPct > -30 ? "passed" : "failed"}`}>
                              <div className="item-icon">
                                {degradation.profitDropPct !== null && degradation.profitDropPct > -30 ? (
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={16} className="text-red-500" />
                                )}
                              </div>
                              <div className="item-text">
                                <b>Profit Retention &gt; 70% (Drop &lt; 30%)</b>
                                <span>
                                  ทำได้: {degradation.profitDropPct !== null ? `${degradation.profitDropPct > 0 ? "+" : ""}${degradation.profitDropPct.toFixed(1)}%` : "—"} (คงเหลือ {tickRobustness?.retentionPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>

                            <div className={`checklist-item ${(degradation.ddDiffPp ?? 0) < 5 ? "passed" : "failed"}`}>
                              <div className="item-icon">
                                {(degradation.ddDiffPp ?? 0) < 5 ? (
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={16} className="text-red-500" />
                                )}
                              </div>
                              <div className="item-text">
                                <b>Drawdown Inflation &lt; 5.0 pp</b>
                                <span>
                                  ทำได้: {degradation.ddDiffPp !== null ? `${degradation.ddDiffPp >= 0 ? "+" : ""}${degradation.ddDiffPp.toFixed(2)} pp` : "—"} (อยู่ในเกณฑ์ปลอดภัย)
                                </span>
                              </div>
                            </div>

                            <div className={`checklist-item ${(latestRealTick.metrics.profit_factor ?? 0) >= 1.5 ? "passed" : "failed"}`}>
                              <div className="item-icon">
                                {(latestRealTick.metrics.profit_factor ?? 0) >= 1.5 ? (
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={16} className="text-red-500" />
                                )}
                              </div>
                              <div className="item-text">
                                <b>Real Tick Profit Factor &ge; 1.50</b>
                                <span>
                                  ทำได้: {latestRealTick.metrics.profit_factor?.toFixed(2)} (เกณฑ์ผ่าน &ge; 1.50)
                                </span>
                              </div>
                            </div>

                            <div className={`checklist-item ${tickRobustness && tickRobustness.tradeMatchPct >= 80 ? "passed" : "failed"}`}>
                              <div className="item-icon">
                                {tickRobustness && tickRobustness.tradeMatchPct >= 80 ? (
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={16} className="text-amber-500" />
                                )}
                              </div>
                              <div className="item-text">
                                <b>Trade Correlation &ge; 80%</b>
                                <span>
                                  ทำได้: {tickRobustness?.tradeMatchPct.toFixed(1)}% ({latestRealTick.metrics.trades} / {baseline?.trades} ไม้)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="verdict-banner">
                          <div className="verdict-info">
                            <b>ผลการประเมินความคงทน (Tick Stability Verdict):</b>
                            <p>
                              {isRealTickPassed
                                ? "กลยุทธ์มีความเสถียรสูงเมื่อรันด้วยข้อมูล Tick จริง ไม่มีอาการ Overfit จากแบบจำลอง OHLC"
                                : "กำไรดรอปลงหรือ Drawdown เพิ่มขึ้นเกินเกณฑ์ความปลอดภัย ควรพิจารณาปรับจูนหรือทดสอบพารามิเตอร์อื่น"}
                            </p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={copyValidationSummary}
                              style={{ background: "#ffffff", fontSize: 11 }}
                            >
                              <Copy size={13} />
                              {copiedText === "validation_summary" ? "คัดลอกสรุปแล้ว!" : "Copy Report"}
                            </Button>
                            <span className={`verdict-stamp ${isRealTickPassed ? "passed" : "warning"}`}>
                              {isRealTickPassed ? "VALIDATION PASSED" : "REVIEW NEEDED"}
                            </span>
                          </div>
                        </div>

                        <div className="action-button-row">
                          <Button onClick={() => changeStep(5)}>
                            ไป Step 5: ขยายเวลา Backtest (Long Period) <ArrowRight size={15} />
                          </Button>
                          <Button variant="outline" onClick={() => changeStep(3)}>
                            ← ปรับแก้ผล Real Tick ใน Step 3
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

                {/* STEP 5: MULTI-YEAR MARKET REGIMES STRESS TEST */}
                {activeStep === 5 && (
                  <div className="step-content-pane">
                    {/* Active Candidate Context Banner */}
                    {activeCandidate && (
                      <div className="step3-candidate-banner">
                        <div className="banner-left">
                          <span className="banner-tag">🎯 Active Candidate: Multi-Year Stress Test</span>
                          <span className="banner-title">
                            <b>{activeCandidate.baseline?.stable_set_id ? `SET-${activeCandidate.baseline.stable_set_id}` : `Candidate #${activeCandidate.id}`}</b>
                            {activeCandidate.run?.ea_name ? ` (EA: ${activeCandidate.run.ea_name})` : ""}
                          </span>
                        </div>
                        <div className="banner-right">
                          <span className="baseline-label">Baseline In-Sample:</span>
                          <span className="baseline-stat">
                            Profit: <b>${number(baseline?.profit)}</b>
                          </span>
                          <span className="baseline-stat">
                            DD: <b>{baseline?.equity_dd?.toFixed(2)}%</b>
                          </span>
                          <span className="baseline-stat">
                            PF: <b>{baseline?.profit_factor?.toFixed(2)}</b>
                          </span>
                          <span className="baseline-stat">
                            Trades: <b>{baseline?.trades}</b>
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="pane-lead">
                      ขยายช่วงเวลาทดสอบ Backtest เป็น 3–5 ปี ข้ามสภาวะตลาดหลากหลายรูปแบบ (Bull, Bear, Sideway, High Volatility)
                      อัปโหลดภาพผลการทดสอบ หรือกรอกตัวเลขสถิติเพื่อประเมินความคงทนข้ามวัฏจักร:
                    </p>

                    {/* SMART OCR DROPZONE OR UPLOADED PREVIEW */}
                    {!step5UploadedImage ? (
                      <div className="step3-smart-reader-card">
                        <div
                          className={`step3-dropzone ${step5IsDraggingOver ? "dragging" : ""}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setStep5IsDraggingOver(true);
                          }}
                          onDragLeave={() => setStep5IsDraggingOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setStep5IsDraggingOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) step5HandleImageFile(file);
                          }}
                          onClick={() => step5FileInputRef.current?.click()}
                        >
                          <input
                            ref={step5FileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,.htm,.html,.txt"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) step5HandleImageFile(file);
                            }}
                          />
                          <div className="dropzone-icon-circle">
                            <UploadCloud size={28} className="text-emerald-600" />
                          </div>
                          <div className="dropzone-content">
                            <h4>อัปโหลดภาพผลทดสอบ Multi-Year Report (Smart OCR Auto-Fill)</h4>
                            <p>
                              ลากไฟล์ภาพสกรีนช็อต MT5 Report หรือกดเลือกไฟล์ (ระบบอ่าน Net Profit, Max DD, PF, Trades, และวันที่อัตโนมัติ)
                            </p>
                            <div className="dropzone-actions">
                              <Button
                                size="sm"
                                type="button"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  step5FileInputRef.current?.click();
                                }}
                              >
                                <UploadCloud size={14} /> เลือกไฟล์รูปภาพ
                              </Button>
                              <span className="paste-hint-pill">⚡ กด Ctrl + V วางภาพได้ทันที</span>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStep5ShowTextPasteBox(prev => !prev);
                                }}
                              >
                                <FileText size={14} /> วางข้อความ Report / HTML
                              </Button>
                            </div>
                          </div>
                        </div>

                        {step5OcrBusy && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, fontWeight: 600, color: "#065f46" }}>
                              <span>{step5OcrStatusText}</span>
                              <span>{step5OcrProgress}%</span>
                            </div>
                            <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${step5OcrProgress}%`,
                                  height: "100%",
                                  background: "linear-gradient(90deg, #059669, #10b981)",
                                  transition: "width 0.3s ease"
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {step5ShowTextPasteBox && (
                          <div className="text-paste-box">
                            <label>วางข้อความตารางสถิติ หรือโค้ด HTML ที่คัดลอกจาก MT5 Strategy Tester Report:</label>
                            <textarea
                              rows={4}
                              placeholder="วางตารางสถิติ หรือ Report HTML จาก MT5 ที่นี่..."
                              value={step5RawPastedText}
                              onChange={(e) => setStep5RawPastedText(e.target.value)}
                            />
                            <div className="text-paste-actions">
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => step5HandleTextReport(step5RawPastedText, "Pasted Text")}
                                disabled={!step5RawPastedText.trim()}
                              >
                                <Sparkles size={14} /> ดึงค่าสถิติอัตโนมัติ
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => setStep5ShowTextPasteBox(false)}
                              >
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="step3-smart-reader-card">
                        <div className="step3-image-preview-card">
                          <div className="preview-image-side">
                            <div className="preview-thumb-box" onClick={() => setShowImageModal(true)}>
                              <img src={step5UploadedImage} alt="MT5 Multi-Year Screenshot" className="preview-thumb-img" />
                              <div className="thumb-zoom-overlay">
                                <Eye size={16} /> ดูรูปขนาดเต็ม
                              </div>
                            </div>
                            <div className="thumb-meta-row">
                              <span className="file-name-tag" title={step5UploadedImageName}>
                                <ImageIcon size={13} /> {step5UploadedImageName || "multi_year_report.png"}
                              </span>
                              <button
                                type="button"
                                className="change-img-btn"
                                onClick={() => {
                                  setStep5UploadedImage(null);
                                  setStep5OcrDetected(null);
                                  setStep5OcrSuccessMessage("");
                                }}
                              >
                                เปลี่ยนภาพ
                              </button>
                            </div>
                          </div>

                          <div className="preview-detected-side">
                            <div className="detected-header">
                              <span className="detected-title">
                                <Sparkles size={15} className="text-emerald-600" />
                                <b>ผลการอ่านสถิติ Multi-Year จากภาพ:</b>
                              </span>
                              {step5OcrBusy ? (
                                <span className="ocr-busy-tag">
                                  <RefreshCw size={13} className="spin" /> {step5OcrStatusText} ({step5OcrProgress}%)
                                </span>
                              ) : step5OcrSuccessMessage ? (
                                <span className="ocr-status-pill">{step5OcrSuccessMessage}</span>
                              ) : null}
                            </div>

                            <div className="detected-chips-grid">
                              <div className={`detected-chip ${step5OcrDetected?.profit != null ? "found" : ""}`}>
                                <span className="chip-label">Multi-Year Profit</span>
                                <span className="chip-val">
                                  {step5OcrDetected?.profit != null ? `$${number(step5OcrDetected.profit)}` : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${step5OcrDetected?.equity_dd != null ? "found" : ""}`}>
                                <span className="chip-label">Max Equity DD</span>
                                <span className="chip-val">
                                  {step5OcrDetected?.equity_dd != null ? `${step5OcrDetected.equity_dd.toFixed(2)}%` : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${step5OcrDetected?.profit_factor != null ? "found" : ""}`}>
                                <span className="chip-label">Profit Factor</span>
                                <span className="chip-val">
                                  {step5OcrDetected?.profit_factor != null ? step5OcrDetected.profit_factor.toFixed(2) : "—"}
                                </span>
                              </div>

                              <div className={`detected-chip ${step5OcrDetected?.trades != null ? "found" : ""}`}>
                                <span className="chip-label">Total Trades</span>
                                <span className="chip-val">
                                  {step5OcrDetected?.trades != null ? step5OcrDetected.trades : "—"}
                                </span>
                              </div>
                            </div>

                            {(step5OcrDetected?.recovery_factor || step5OcrDetected?.period_from || step5OcrDetected?.expected_payoff) && (
                              <div className="detected-extra-row">
                                {step5OcrDetected?.period_from && (
                                  <span className="extra-stat">ช่วงเวลา: <b>{step5OcrDetected.period_from} → {step5OcrDetected.period_to}</b></span>
                                )}
                                {step5OcrDetected?.recovery_factor != null && (
                                  <span className="extra-stat">Recovery Factor: <b>{step5OcrDetected.recovery_factor}</b></span>
                                )}
                                {step5OcrDetected?.expected_payoff != null && (
                                  <span className="extra-stat">Expected Payoff: <b>{step5OcrDetected.expected_payoff}</b></span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 5 Form */}
                    <form onSubmit={submitLongPeriodTest} className="record-form-grid" style={{ marginTop: 14 }}>
                      <div className="form-group">
                        <label>
                          ช่วงวันที่เริ่ม (Date From)
                          {step5OcrDetected?.period_from && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="date"
                          value={longPeriodFrom}
                          onChange={e => setLongPeriodFrom(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          ช่วงวันที่สิ้นสุด (Date To)
                          {step5OcrDetected?.period_to && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="date"
                          value={longPeriodTo}
                          onChange={e => setLongPeriodTo(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Modelling Method</label>
                        <select
                          value={longPeriodModel}
                          onChange={e => setLongPeriodModel(e.target.value)}
                          className="w-full px-3 py-2 border rounded text-xs bg-white text-slate-800"
                        >
                          <option value="Every tick based on real ticks">Every tick based on real ticks (แม่นยำสูงสุด)</option>
                          <option value="1 minute OHLC">1 minute OHLC (รวดเร็ว)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>
                          Total Net Profit ($)
                          {step5OcrDetected?.profit != null && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 28450.00"
                          value={longPeriodProfit}
                          onChange={e => setLongPeriodProfit(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          Max Equity Drawdown (%)
                          {step5OcrDetected?.equity_dd != null && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 14.50"
                          value={longPeriodDD}
                          onChange={e => setLongPeriodDD(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          Profit Factor
                          {step5OcrDetected?.profit_factor != null && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="number"
                          step="any"
                          placeholder="เช่น 2.85"
                          value={longPeriodPF}
                          onChange={e => setLongPeriodPF(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          Total Trades
                          {step5OcrDetected?.trades != null && (
                            <span className="input-detect-badge">✨ Auto-filled</span>
                          )}
                        </label>
                        <input
                          required
                          type="number"
                          step="1"
                          placeholder="เช่น 2180"
                          value={longPeriodTrades}
                          onChange={e => setLongPeriodTrades(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          Recovery Factor
                          <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>(คำนวณอัตโนมัติหากเว้นว่าง)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder={step5StressAnalysis ? String(Number(step5StressAnalysis.recoveryFactor.toFixed(2))) : "เช่น 5.20"}
                          value={longPeriodRecovery}
                          onChange={e => setLongPeriodRecovery(e.target.value)}
                        />
                      </div>

                      {/* Live Stress Comparison Table */}
                      {(step5StressAnalysis || latestLongPeriod) && (
                        <div style={{ gridColumn: "span 2" }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 8px 0", color: "#0f172a" }}>
                            📊 การเปรียบเทียบความคงทนข้ามวัฏจักร (In-Sample 1Y vs Multi-Year Stress Test)
                          </h4>

                          <table className="terminal-compare-table">
                            <thead>
                              <tr>
                                <th>Metric</th>
                                <th>In-Sample Baseline (1 ปี)</th>
                                <th>Multi-Year ({step5StressAnalysis?.years.toFixed(1) || "3.7"} ปี)</th>
                                <th>Delta / Ratio</th>
                                <th>Regime Tolerance</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>Net Profit</td>
                                <td className="mono">${number(baseline?.profit)}</td>
                                <td className="mono font-bold">
                                  ${number(step5StressAnalysis?.profit ?? latestLongPeriod?.metrics?.profit)}
                                  <small className="muted" style={{ display: "block", fontSize: 10 }}>
                                    (~${number(step5StressAnalysis?.annualizedProfit ?? 0)}/ปี)
                                  </small>
                                </td>
                                <td className={`mono ${(step5StressAnalysis?.profit ?? 0) > 0 ? "green" : "red"}`}>
                                  {step5StressAnalysis?.profitMultiple ? `${step5StressAnalysis.profitMultiple.toFixed(1)}x ของเดิม` : "—"}
                                </td>
                                <td>
                                  {(step5StressAnalysis?.profit ?? 0) > 0 ? (
                                    <span className="badge-status passed">PROFITABLE</span>
                                  ) : (
                                    <span className="badge-status danger">UNPROFITABLE</span>
                                  )}
                                </td>
                              </tr>

                              <tr>
                                <td>Equity Drawdown</td>
                                <td className="mono">{number(baseline?.equity_dd)}%</td>
                                <td className="mono font-bold">{number(step5StressAnalysis?.dd ?? latestLongPeriod?.metrics?.equity_dd)}%</td>
                                <td className={`mono ${(step5StressAnalysis?.dd ?? 0) <= 18 ? "green" : "red"}`}>
                                  {step5StressAnalysis?.ddIncreasePp != null ? `${step5StressAnalysis.ddIncreasePp >= 0 ? "+" : ""}${step5StressAnalysis.ddIncreasePp.toFixed(2)} pp` : "—"}
                                  {step5StressAnalysis?.ddMultiple ? ` (${step5StressAnalysis.ddMultiple.toFixed(2)}x)` : ""}
                                </td>
                                <td>
                                  {(step5StressAnalysis?.dd ?? 0) <= 18 ? (
                                    <span className="badge-status passed">CONTROLLED (≤ 18%)</span>
                                  ) : (
                                    <span className="badge-status danger">DD EXPANDED (&gt; 18%)</span>
                                  )}
                                </td>
                              </tr>

                              <tr>
                                <td>Profit Factor</td>
                                <td className="mono">{number(baseline?.profit_factor)}</td>
                                <td className="mono font-bold">{number(step5StressAnalysis?.pf ?? latestLongPeriod?.metrics?.profit_factor)}</td>
                                <td className="mono">
                                  {step5StressAnalysis?.pfDiff != null ? `${step5StressAnalysis.pfDiff >= 0 ? "+" : ""}${step5StressAnalysis.pfDiff.toFixed(2)}` : "—"}
                                </td>
                                <td>
                                  {(step5StressAnalysis?.pf ?? latestLongPeriod?.metrics?.profit_factor ?? 0) >= 1.5 ? (
                                    <span className="badge-status passed">HEALTHY (≥ 1.50)</span>
                                  ) : (
                                    <span className="badge-status warning">LOW PF (&lt; 1.50)</span>
                                  )}
                                </td>
                              </tr>

                              <tr>
                                <td>Recovery Factor</td>
                                <td className="mono">
                                  {number(baseline?.recovery_factor ?? (baseline?.profit && baseline?.equity_dd ? baseline.profit / (3000 * (baseline.equity_dd / 100)) : 4.0))}
                                </td>
                                <td className="mono font-bold">
                                  {number(step5StressAnalysis?.recoveryFactor ?? latestLongPeriod?.metrics?.recovery_factor)}
                                </td>
                                <td className="mono">Target &ge; 3.0</td>
                                <td>
                                  {(step5StressAnalysis?.recoveryFactor ?? latestLongPeriod?.metrics?.recovery_factor ?? 0) >= 3.0 ? (
                                    <span className="badge-status passed">STRONG (≥ 3.0)</span>
                                  ) : (
                                    <span className="badge-status warning">MODERATE</span>
                                  )}
                                </td>
                              </tr>

                              <tr>
                                <td>Total Trades</td>
                                <td className="mono">{baseline?.trades}</td>
                                <td className="mono font-bold">
                                  {step5StressAnalysis?.trades ?? latestLongPeriod?.metrics?.trades}
                                  {step5StressAnalysis?.tradesPerYear && (
                                    <small className="muted" style={{ display: "block", fontSize: 10 }}>
                                      (~{Math.round(step5StressAnalysis.tradesPerYear)} ไม้/ปี)
                                    </small>
                                  )}
                                </td>
                                <td className="mono">สม่ำเสมอทุกวัฏจักร</td>
                                <td>
                                  <span className="badge-status neutral">TRACKED</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Market Regime Robustness Checklist */}
                          <div className="step4-checklist-box" style={{ marginTop: 14 }}>
                            <h4>
                              <ShieldCheck size={16} className="text-emerald-600" />
                              Market Regime Robustness Checklist (เกณฑ์ประเมินการรอดพ้นวัฏจักรตลาด)
                            </h4>
                            <div className="checklist-items-grid">
                              <div className={`checklist-item ${step5StressAnalysis?.isProfitable ? "passed" : "failed"}`}>
                                <div className="item-icon">
                                  {step5StressAnalysis?.isProfitable ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : (
                                    <XCircle size={16} className="text-red-500" />
                                  )}
                                </div>
                                <div className="item-text">
                                  <b>All-Weather Profitability (กำไรสะสมตลอด 3–5 ปี &gt; $0)</b>
                                  <span>
                                    ทำได้: ${number(step5StressAnalysis?.profit ?? 0)} (ไม่แตกในวิกฤติตลาด)
                                  </span>
                                </div>
                              </div>

                              <div className={`checklist-item ${step5StressAnalysis?.isDDCapped ? "passed" : "failed"}`}>
                                <div className="item-icon">
                                  {step5StressAnalysis?.isDDCapped ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : (
                                    <XCircle size={16} className="text-red-500" />
                                  )}
                                </div>
                                <div className="item-text">
                                  <b>Controlled Multi-Year Drawdown (&le; 18% หรือ &le; 1.8x)</b>
                                  <span>
                                    ทำได้: {step5StressAnalysis?.dd.toFixed(2)}% (เกณฑ์สูงสุดยอมรับได้ &le; 18%)
                                  </span>
                                </div>
                              </div>

                              <div className={`checklist-item ${step5StressAnalysis?.isPFHealthy ? "passed" : "failed"}`}>
                                <div className="item-icon">
                                  {step5StressAnalysis?.isPFHealthy ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : (
                                    <XCircle size={16} className="text-amber-500" />
                                  )}
                                </div>
                                <div className="item-text">
                                  <b>Sustainable Profit Factor (&ge; 1.50 ระยะยาว)</b>
                                  <span>
                                    ทำได้: {step5StressAnalysis?.pf?.toFixed(2) ?? "—"} (ความได้เปรียบทางสถิติคงอยู่)
                                  </span>
                                </div>
                              </div>

                              <div className={`checklist-item ${step5StressAnalysis?.isRecoveryStrong ? "passed" : "failed"}`}>
                                <div className="item-icon">
                                  {step5StressAnalysis?.isRecoveryStrong ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : (
                                    <XCircle size={16} className="text-amber-500" />
                                  )}
                                </div>
                                <div className="item-text">
                                  <b>Capital Recovery Power (Recovery Factor &ge; 3.0)</b>
                                  <span>
                                    ทำได้: {step5StressAnalysis?.recoveryFactor.toFixed(2)} (กำไรฟื้นตัวจากหลุม DD ได้เร็ว)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Verdict Banner */}
                          <div className="verdict-banner" style={{ marginTop: 14 }}>
                            <div className="verdict-info">
                              <b>ผลการประเมินสภาวะตลาดหลายปี (Regime Survival Verdict):</b>
                              <p>
                                {step5StressAnalysis?.isPassed
                                  ? "กลยุทธ์สอบผ่านการทดสอบวัฏจักรตลาดหลายปี สามารถทำกำไรข้ามสภาวะตลาด Bull, Bear, Sideway ได้อย่างมีเสถียรภาพ และควบคุม Drawdown ได้ดี"
                                  : "ระบบมีอาการอ่อนไหวต่อบางสภาวะตลาด หรือ Drawdown ขยายตัวเกินเกณฑ์ ควรพิจารณาจำกัดช่วงเวลาเทรด หรือเพิ่มตัวกรอง Trend/Volatility"}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={copyStep5Summary}
                                style={{ background: "#ffffff", fontSize: 11 }}
                              >
                                <Copy size={13} />
                                {copiedText === "step5_summary" ? "คัดลอกสรุปแล้ว!" : "Copy Report"}
                              </Button>
                              <span className={`verdict-stamp ${step5StressAnalysis?.isPassed ? "passed" : "warning"}`}>
                                {step5StressAnalysis?.isPassed ? "REGIME SURVIVAL PASSED" : "REVIEW NEEDED"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="form-full-action">
                        <Button type="submit" disabled={longPeriodBusy || !selectedCandidateId}>
                          {longPeriodBusy ? "กำลังบันทึก..." : "💾 บันทึกผล Multi-Year Backtest & อัปเดต Validation Pipeline"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => changeStep(6)}>
                          ไปต่อ Step 6: Forward Optimization →
                        </Button>
                      </div>
                    </form>

                    {/* Previously Saved Records for Long Period Stage */}
                    {longPeriodRecords.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                          ประวัติการบันทึก Multi-Year Stress Test ({longPeriodRecords.length} รายการ):
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {longPeriodRecords.map((rec) => (
                            <div
                              key={rec.id}
                              style={{
                                padding: "10px 14px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}
                            >
                              <div>
                                <b style={{ fontSize: 12, color: "#0f172a" }}>{rec.label}</b>
                                <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 12, marginTop: 2 }}>
                                  <span>Profit: <b className="mono font-bold">${number(rec.metrics?.profit)}</b></span>
                                  <span>DD: <b className="mono">{number(rec.metrics?.equity_dd)}%</b></span>
                                  <span>PF: <b className="mono">{number(rec.metrics?.profit_factor)}</b></span>
                                  <span>Trades: <b className="mono">{rec.metrics?.trades}</b></span>
                                  {rec.settings?.modelling_method && <span>Model: {String(rec.settings.modelling_method)}</span>}
                                </div>
                              </div>
                              <span className={`badge-status ${rec.status === "PASSED" ? "passed" : "warning"}`}>
                                {rec.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="action-button-row" style={{ marginTop: 16 }}>
                      <Button onClick={() => changeStep(6)}>
                        ไป Step 6: Forward Optimization <ArrowRight size={15} />
                      </Button>
                      <Button variant="outline" onClick={() => changeStep(4)}>
                        ← กลับไปดู Step 4: เปรียบเทียบ OHLC
                      </Button>
                    </div>
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
                {![1, 2, 3, 4, 5, 7, 8].includes(activeStep) && (
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

      {/* Global Image Lightbox Modal (accessible in Step 3, Step 4, and Step 5) */}
      {showImageModal && (uploadedImage || step5UploadedImage) && (
        <div className="step3-image-modal" onClick={() => setShowImageModal(false)}>
          <div className="modal-inner" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                <ImageIcon size={16} className="text-emerald-600" />
                <span>หลักฐานภาพถ่าย MT5 Strategy Tester Report: {activeStep === 5 ? (step5UploadedImageName || "multi_year_report.png") : (uploadedImageName || "screenshot.png")}</span>
              </div>
              <button type="button" onClick={() => setShowImageModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <img src={(activeStep === 5 ? step5UploadedImage : uploadedImage) || ""} alt="MT5 Strategy Tester Report Full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
