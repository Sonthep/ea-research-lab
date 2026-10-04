import { Suspense } from "react";
import { WorkflowPage } from "@/features/workflow/workflow-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="loading">กำลังโหลด 11-Step Quant Workflow…</div>}>
      <WorkflowPage />
    </Suspense>
  );
}
