import { useState } from "react";
import { CalendarCheck, Clock, User, ChevronRight, BookOpen, LinkIcon, FileText, Layers } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { fileUrl } from "@/lib/media";

const ATT = {
  present: { l: "Hadir", c: "#047857", bg: "#D1FAE5" },
  late: { l: "Terlambat", c: "#B45309", bg: "#FEF3C7" },
  absent: { l: "Tidak Hadir", c: "#B91C1C", bg: "#FEE2E2" },
};

export default function StudentSchedule() {
  const { data, loading } = useFetch("/student/schedule");

  return (
    <div data-testid="student-schedule">
      <PageHeader title="Jadwal Saya" subtitle="Kelas terkonfirmasi beserta jadwal tiap pertemuan dan materi yang akan dibahas." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={CalendarCheck} title="Belum ada jadwal" desc="Jadwal kelas akan muncul setelah tentor dikonfirmasi." />
      ) : (
        <div className="space-y-4">
          {data.map((c) => <ClassCard key={c.id} cls={c} />)}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && !detail) {
      setLoading(true);
      try { const { data } = await api.get(`/student/classes/${cls.id}`); setDetail(data); }
      catch { /* ignore */ } finally { setLoading(false); }
    }
  };

  const sessions = cls.sessions || [];
  const materials = detail?.materials || [];
  const myAtt = detail?.my_attendance || {};

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden" data-testid={`schedule-${cls.id}`}>
      <button onClick={toggle} className="w-full p-5 flex items-center gap-5 text-left hover:bg-[#F8FAFC] transition-colors duration-200" data-testid={`schedule-toggle-${cls.id}`}>
        <div className="h-14 w-14 rounded-xl bg-[#E6F5F8] text-[#0E7490] flex flex-col items-center justify-center shrink-0">
          <Layers className="h-5 w-5" /><span className="text-[10px] font-bold mt-0.5">{sessions.length}x</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[#0A1128]">{cls.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
            <span>{cls.subject}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {sessions.length} pertemuan</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {cls.tutor_name}</span>
            <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {cls.material_count} materi</span>
          </div>
        </div>
        <ChevronRight className={`h-5 w-5 text-[#94A3B8] transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[#E2E8F0] p-4" data-testid={`schedule-detail-${cls.id}`}>
          {loading ? <Loading /> : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const mats = materials.filter((m) => m.session_id === s.id);
                const att = ATT[myAtt[s.id]];
                return (
                  <div key={s.id} className="rounded-xl border border-[#E2E8F0] p-4" data-testid={`student-session-${s.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[#EFF6F8] text-[#0E7490] flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] uppercase leading-none">Ke</span><span className="text-sm font-bold leading-none">{s.no}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0A1128]">{s.topic || `Pertemuan ${s.no}`}</p>
                          <p className="text-xs text-[#94A3B8] flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(s.date)} · {s.start_time}-{s.end_time}</p>
                        </div>
                      </div>
                      {att && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0" style={{ color: att.c, backgroundColor: att.bg }}>{att.l}</span>}
                    </div>
                    {mats.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#F1F5F9] space-y-2" data-testid={`student-materials-${s.id}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Materi</p>
                        {mats.map((m) => (
                          <div key={m.id} className="flex items-start gap-2" data-testid={`student-material-${m.id}`}>
                            <BookOpen className="h-4 w-4 text-[#0E7490] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-[#0A1128] font-medium">{m.title}</p>
                              {m.description && <p className="text-xs text-[#475569]">{m.description}</p>}
                              <div className="flex flex-wrap gap-3 mt-0.5 text-xs">
                                {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0E7490] hover:underline"><LinkIcon className="h-3 w-3" /> Buka tautan</a>}
                                {m.file_url && <a href={fileUrl(m.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#10B981] hover:underline"><FileText className="h-3 w-3" /> {m.file_name || "Unduh berkas"}</a>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
