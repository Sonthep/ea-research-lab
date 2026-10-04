import Link from "next/link";
import { ChevronLeft, ChevronRight, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Heading({ title, description, children }: { eyebrow?: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export function ErrorBox({ message }: { message: string }) { return message ? <div className="error" role="alert"><AlertTriangle size={18} />{message}</div> : null; }
export function Empty({ title, message, href = "/imports" }: { title: string; message: string; href?: string }) { return <div className="empty"><h3>{title}</h3><p>{message}</p><Link href={href}>Get started <ArrowRight size={15} /></Link></div>; }
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination"><span>{total ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, total).toLocaleString()}` : "0"} of {total.toLocaleString()} records</span><div><Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></Button><span>Page {page} / {pages}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></Button></div></div>;
}
