import { SetDetail } from "@/features/sets/set-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SetDetail id={id} />; }
