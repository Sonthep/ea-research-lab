import { Suspense } from "react";
import { Discovery } from "@/features/discovery/discovery";
export default function Page() { return <Suspense fallback={<div className="loading">Loading discovery…</div>}><Discovery /></Suspense>; }
