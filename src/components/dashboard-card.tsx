import type { ReactNode } from "react";

type DashboardCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function DashboardCard({
  title,
  description,
  children,
  className = "",
}: DashboardCardProps) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-slate-950/20 ${className}`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
