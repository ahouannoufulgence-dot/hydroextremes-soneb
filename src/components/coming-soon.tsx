import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-brand-900">{title}</h1>
      <p className="mt-1 text-muted">{description}</p>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-16 text-center text-muted">
        <Construction className="size-8 text-brand-600" />
        Cet écran sera construit dans une prochaine étape.
      </div>
    </div>
  );
}
