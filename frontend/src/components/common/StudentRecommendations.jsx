import { Link } from "react-router-dom";
import { Sparkles, Target, ClipboardList, BookOpen } from "lucide-react";
import useFetch from "@/hooks/useFetch";

const exLink = (t) => (t.kind === "exercise" && t.course_id ? `/student/courses/${t.course_id}/learn` : "/student/tryouts");

export default function StudentRecommendations() {
  const { data } = useFetch("/student/recommendations");
  if (!data?.has_data || !data.recommendations) return null;
  const rec = data.recommendations;
  const hasItems = (rec.exercises?.length || 0) + (rec.courses?.length || 0) > 0;

  return (
    <div className="mt-8 rounded-2xl border border-[#DCE6FF] bg-[#F4F7FE] p-6" data-testid="student-recommendations">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-[#4361EE]" />
        <h3 className="font-semibold text-[#0A1128]">Rekomendasi Latihan untuk Kamu</h3>
      </div>
      <p className="text-sm text-[#475569] flex items-center gap-1.5">
        <Target className="h-4 w-4 text-[#EF4444]" /> Fokus perbaikan:
        <span className="font-semibold text-[#0A1128]">{rec.focus_subject || "—"}</span>
        {rec.focus_competency && <>· kompetensi <span className="font-semibold text-[#0A1128]">{rec.focus_competency}</span></>}
      </p>

      {!hasItems ? (
        <p className="mt-3 text-sm text-[#94A3B8]">Belum ada latihan atau kursus yang cocok untuk area ini. Terus berlatih!</p>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {rec.exercises?.length > 0 && (
            <div data-testid="rec-exercises">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> Latihan Soal</p>
              <div className="space-y-2">
                {rec.exercises.map((t) => (
                  <Link key={t.id} to={exLink(t)} className="block rounded-lg bg-white border border-[#E2E8F0] px-3 py-2.5 hover:border-[#4361EE] transition-colors duration-200" data-testid={`rec-exercise-${t.id}`}>
                    <p className="text-sm font-medium text-[#0A1128] truncate">{t.title}</p>
                    <p className="text-xs text-[#94A3B8]">{t.subject} · {t.kind === "exercise" ? "Latihan" : "Try Out"}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {rec.courses?.length > 0 && (
            <div data-testid="rec-courses">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2 flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Kursus</p>
              <div className="space-y-2">
                {rec.courses.map((c) => (
                  <Link key={c.id} to="/student/courses" className="block rounded-lg bg-white border border-[#E2E8F0] px-3 py-2.5 hover:border-[#4361EE] transition-colors duration-200" data-testid={`rec-course-${c.id}`}>
                    <p className="text-sm font-medium text-[#0A1128] truncate">{c.title}</p>
                    <p className="text-xs text-[#94A3B8]">{c.subject}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
