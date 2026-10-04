"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Layers,
  Table2,
  Bookmark,
  Upload,
  Settings,
  Menu,
  X,
  ScanSearch,
  Workflow,
  Sparkles
} from "lucide-react";

const links = [
  ["/workflow", "Quant Workflow (11 Steps)", Workflow, true],
  ["/dashboard", "Dashboard", LayoutDashboard, false],
  ["/discovery", "Candidate Discovery", ScanSearch, false],
  ["/candidates", "Candidate Sets", Bookmark, false],
  ["/explorer", "Optimization Explorer", Table2, false],
  ["/runs", "Optimization Runs", Layers, false],
  ["/imports", "Imports", Upload, false],
  ["/settings", "Settings", Settings, false],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = links.find(([href]) => path.startsWith(href))?.[1] || "Quant Laboratory";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-row">
          <Link href="/workflow" className="brand" aria-label="EA Research Lab home" onClick={() => setMenuOpen(false)}>
            <span className="brand-icon"><Activity size={21} /></span>
            <span>
              EA Research Lab
              <small>Quant Validation Engine</small>
            </span>
          </Link>
          <button
            className="mobile-nav-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        <div className="nav-label">RESEARCH PIPELINE</div>
        <nav id="workspace-navigation" aria-label="Main navigation" className={menuOpen ? "mobile-open" : ""}>
          {links.map(([href, label, Icon, isFeatured]) => {
            const isActive = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`nav-link ${isActive ? "active" : ""} ${isFeatured ? "nav-link-featured" : ""}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {isFeatured && <span className="nav-tag-badge">FLOW</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="dot dot-live" />
            <span>Terminal Connected</span>
          </div>
          <small className="system-version">MT5 Evidence Engine v2.0</small>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="topbar-left">
            <span>Workspace</span>
            <span className="topbar-sep">/</span>
            <b>{current}</b>
          </div>
          <div className="topbar-right">
            <Link href="/workflow" className="topbar-flow-btn">
              <Sparkles size={14} className="accent-icon" />
              <span>11-Step Flow State</span>
            </Link>
            <span className="topbar-context">MetaTrader 5 Research Environment</span>
          </div>
        </header>

        <main>{children}</main>

        <footer className="app-footer">
          <span>MetaTrader 5 remains the execution &amp; backtesting engine. All scores and metrics are discovery evidence, not future profitability forecasts.</span>
        </footer>
      </div>
    </div>
  );
}
