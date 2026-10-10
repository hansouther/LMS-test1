import { Loader2 } from "lucide-react";

export default function FullScreenLoader({ label = "Memuat..." }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#EFF6F8]" data-testid="fullscreen-loader">
      <div className="h-12 w-12 rounded-2xl bg-[#0E7490] flex items-center justify-center shadow-lg shadow-[#0E7490]/30">
        <Loader2 className="h-6 w-6 text-white animate-spin" />
      </div>
      <p className="text-sm text-[#475569] font-medium">{label}</p>
    </div>
  );
}
