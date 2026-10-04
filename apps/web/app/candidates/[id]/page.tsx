import { CandidateDetailView } from "@/features/candidates/candidate-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CandidateDetailView id={id} />; }
