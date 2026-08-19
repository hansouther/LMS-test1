import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, HelpCircle, PlayCircle, Eye } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";

const STATUS = {
  submitted: { label: "Selesai", color: "#10B981", bg: "#ECFDF5" },
  in_progress: { label: "Sedang Dikerjakan", color: "#FF9F1C", bg: "#FFF4E5" },
  null: { label: "Belum Dikerjakan", color: "#4361EE", bg: "#EEF2FF" },
};

export default function TryoutList() {
  const { data, loading } = useFetch("/student/tryouts");
  const navigate = useNavigate();

  return (
    <div data-testid="tryout-list">
      <PageHeader title="CBT / Try Out" subtitle="Kerjakan Try Out dan latihan soal dengan penilaian otomatis (pilihan ganda, kompleks, benar/salah, & esai)." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={ClipboardList} title="Belum ada Try Out" desc="Paket soal yang dirilis admin akan muncul di sini." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((t) => {
            const st = STATUS[t.attempt_status] || STATUS.null;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col hover:-translate-y-1 transition-transform duration-200" data-testid={`tryout-${t.id}`}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#F4F7FE] px-3 py-1 text-[11px] font-semibold text-[#475569]">{t.subject}</span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                </div>
                <h3 className="mt-4 font-semibold text-[#0A1128]">{t.title}</h3>
                <p className="mt-1.5 text-sm text-[#475569] line-clamp-2 flex-1">{t.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> {t.question_count} soal</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.duration_minutes} menit</span>
                </div>
                <div className="mt-5">
                  {t.attempt_status === "submitted" ? (
                    <div className="flex items-center justify-between">
                      <span className="font-mono2 text-2xl font-bold" style={{ color: t.my_percentage >= 70 ? "#10B981" : "#FF9F1C" }}>{t.my_percentage}%</span>
                      <Button variant="outline" size="sm" className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" onClick={() => navigate(`/student/results/${t.attempt_id}`)} data-testid={`view-result-${t.id}`}>
                        <Eye className="h-4 w-4" /> Lihat Hasil
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full rounded-full bg-[#4361EE] hover:bg-[#344ED0]" onClick={() => navigate(`/student/exam/${t.id}`)} data-testid={`start-tryout-${t.id}`}>
                      <PlayCircle className="h-4 w-4" /> {t.attempt_status === "in_progress" ? "Lanjutkan" : "Mulai Kerjakan"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
