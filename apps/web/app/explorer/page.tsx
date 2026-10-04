import { Suspense } from "react";
import { Explorer } from "@/features/explorer/explorer";
export default function Page() { return <Suspense fallback={<div className="loading">Loading Explorer…</div>}><Explorer /></Suspense>; }
