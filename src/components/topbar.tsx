import { Bell, ChevronDown, Menu, User } from "lucide-react";
import { Logo } from "./logo";
import { TestBanner } from "./test-banner";

export function Topbar() {
  return (
    <>
      <TestBanner />
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <Menu className="size-5 text-muted" aria-label="Menu" />
          <Logo />
        </div>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid size-10 place-items-center rounded-full hover:bg-brand-50"
          >
            <Bell className="size-5" strokeWidth={1.75} />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-500 ring-2 ring-surface" />
          </button>
          <button type="button" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-brand-50">
            <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-brand-600">
              <User className="size-5" fill="currentColor" strokeWidth={0} />
            </span>
            <span className="hidden text-left text-sm leading-tight sm:block">
              <span className="block font-semibold">SONEB</span>
              <span className="block text-muted">Utilisateur</span>
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </div>
      </header>
    </>
  );
}
