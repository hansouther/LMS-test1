import { useState, useEffect, useCallback } from "react";
import { MonitorPlay, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { formatDateTime } from "@/lib/format";

const STATE = {
  in_progress: { l: "Sedang Mengerjakan", c: "#FF9F1C", bg: "#FFF4E5", pulse: true },
  submitted: { l: "Selesai", c: "#10B981", bg: "#ECFDF5" },
  idle: { l: "Tidak Aktif", c: "#94A3B8", bg: "#F1F5F9" },
};

export default function LiveMonitoring() {
  const [rows, setRows] = useState(null);
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/proctor/monitoring");
      setRows(data);
      setUpdated(new Date());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div data-testid="live-monitoring">
      <PageHeader title="Live Monitoring" subtitle="Pemantauan aktivitas belajar & ujian siswa sekolah Anda (diperbarui otomatis setiap 10 detik)."
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-600 px-3 py-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
            <button onClick={load} className="p-2 rounded-full hover:bg-[#EEF2FF] text-[#4361EE]" data-testid="refresh-monitoring"><RefreshCw className="h-4 w-4" /></button>
          </div>
        } />

      {rows === null ? <Loading /> : rows.length === 0 ? (
        <Empty icon={MonitorPlay} title="Belum ada siswa" desc="Belum ada siswa terdaftar dari sekolah Anda." />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => {
              const st = STATE[r.status] || STATE.idle;
              return (
                <div key={r.student_id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`monitor-${r.student_id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center text-sm font-bold">
                        {r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[#0A1128]">{r.name}</p>
                        <p className="text-xs text-[#94A3B8]">{r.email}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }}>
                      {st.pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: st.c }} />}
                      {st.l}
                    </span>
                  </div>
                  <div className="mt-4 rounded-lg bg-[#F4F7FE] p-3">
                    <p className="text-xs text-[#94A3B8]">Aktivitas terakhir</p>
                    <p className="text-sm font-medium text-[#0A1128] mt-0.5">{r.activity}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] text-[#94A3B8]">{r.last_time ? formatDateTime(r.last_time) : "-"}</span>
                      {r.last_score != null && <span className="font-mono2 text-sm font-bold" style={{ color: r.last_score >= 70 ? "#10B981" : "#FF9F1C" }}>{r.last_score}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {updated && <p className="mt-6 text-xs text-[#94A3B8] text-center">Terakhir diperbarui: {updated.toLocaleTimeString("id-ID")}</p>}
        </>
      )}
    </div>
  );
}
