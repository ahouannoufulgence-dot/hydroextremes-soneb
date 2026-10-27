"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Database,
  LineChart,
  Lightbulb,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/stations", label: "Stations", icon: MapPin },
  { href: "/donnees", label: "Données & import", icon: Database },
  { href: "/analyse", label: "Analyse & fréquences", icon: LineChart },
  { href: "/aide-decision", label: "Aide à la décision", icon: Lightbulb },
  { href: "/rapports", label: "Rapports & exports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="border-b border-line px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors ${
                active
                  ? "bg-brand-100 text-brand-700 shadow-[inset_3px_0_0_var(--color-brand-600)]"
                  : "text-ink hover:bg-brand-50"
              }`}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-5 text-sm">
        <div className="font-semibold text-brand-900">HydroExtrêmes SONEB</div>
        <div className="text-muted">Pour une gestion résiliente de l&apos;eau</div>
      </div>
    </aside>
  );
}
