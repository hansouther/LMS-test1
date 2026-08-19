import { Loader2, Inbox } from "lucide-react";

export function Loading({ label }) {
  return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8] gap-2" data-testid="loading-state">
      <Loader2 className="h-5 w-5 animate-spin" /> {label || "Memuat data..."}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
      <div className="h-14 w-14 rounded-2xl bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-semibold text-[#0A1128]">{title}</h3>
      {desc && <p className="mt-1 text-sm text-[#94A3B8] max-w-sm">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
