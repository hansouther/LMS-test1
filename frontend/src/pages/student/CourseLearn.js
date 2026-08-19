import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, PlayCircle, FileText, Trophy, Award, ClipboardList, Eye, Youtube } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import { fileUrl, youtubeEmbed } from "@/lib/media";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";

export default function CourseLearn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useFetch(`/student/courses/${id}/learn`);
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (data?.lessons?.length && !active) setActive(data.lessons[0]);
  }, [data]); // eslint-disable-line

  if (loading) return <Loading />;

  return (
    <div data-testid="course-learn">
      <Button variant="ghost" onClick={() => navigate("/student/courses")} className="mb-3 text-[#475569] hover:text-[#4361EE] hover:bg-[#EEF2FF]"><ArrowLeft className="h-4 w-4" /> Kembali</Button>

      <div className="rounded-2xl bg-[#0A1128] text-white p-6 mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <p className="text-white/60 text-sm">{data.course.subject}</p>
          <h1 className="text-2xl font-bold">{data.course.title}</h1>
        </div>
        <div className="flex gap-4">
          <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
            <p className="font-mono2 text-2xl font-bold text-[#FF9F1C]">{data.grade.total_points}</p>
            <p className="text-[11px] text-white/60">Total Poin</p>
          </div>
          <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
            <p className="font-mono2 text-2xl font-bold text-[#10B981]">{data.grade.average}%</p>
            <p className="text-[11px] text-white/60">Rata-rata ({data.grade.taken}/{data.grade.total})</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video player + attachments */}
        <div className="lg:col-span-2">
          {active ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" data-testid="lesson-player">
              <div className="aspect-video bg-black">
                {active.video_type === "youtube" ? (
                  <iframe title={active.title} src={youtubeEmbed(active.video_url)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                ) : (
                  <video src={fileUrl(active.video_url)} controls className="w-full h-full" />
                )}
              </div>
              <div className="p-5">
                <h2 className="font-semibold text-[#0A1128]">{active.title}</h2>
                <p className="mt-1 text-sm text-[#475569]">{active.description}</p>
                {active.attachments?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-[#94A3B8] mb-2">LAMPIRAN</p>
                    <div className="space-y-2">
                      {active.attachments.map((a, i) => (
                        <a key={i} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#4361EE] hover:underline" data-testid={`attachment-${i}`}>
                          <FileText className="h-4 w-4" /> {a.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : <Empty icon={PlayCircle} title="Belum ada video" desc="Materi video akan muncul di sini." />}
        </div>

        {/* Lesson list + exercises */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
            <h3 className="font-semibold text-[#0A1128] mb-3 flex items-center gap-2"><PlayCircle className="h-5 w-5 text-[#4361EE]" /> Daftar Pelajaran</h3>
            <div className="space-y-1">
              {data.lessons.map((l) => (
                <button key={l.id} onClick={() => setActive(l)} data-testid={`lesson-item-${l.id}`}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 transition-colors duration-200 ${active?.id === l.id ? "bg-[#EEF2FF] text-[#4361EE] font-medium" : "text-[#475569] hover:bg-[#F4F7FE]"}`}>
                  {l.video_type === "youtube" ? <Youtube className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                  <span className="truncate">{l.title}</span>
                </button>
              ))}
              {data.lessons.length === 0 && <p className="text-sm text-[#94A3B8]">Belum ada pelajaran.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
            <h3 className="font-semibold text-[#0A1128] mb-3 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#FF9F1C]" /> Latihan Bernilai</h3>
            <div className="space-y-3">
              {data.exercises.map((ex) => (
                <div key={ex.id} className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`course-exercise-${ex.id}`}>
                  <p className="font-medium text-sm text-[#0A1128]">{ex.title}</p>
                  <p className="text-xs text-[#94A3B8]">{ex.question_count} soal · {ex.duration_minutes} menit</p>
                  <div className="mt-2">
                    {ex.attempt_status === "submitted" ? (
                      <div className="flex items-center justify-between">
                        <span className="font-mono2 font-bold text-sm" style={{ color: ex.my_percentage >= 70 ? "#10B981" : "#FF9F1C" }}>{ex.my_score}/{ex.my_max} ({ex.my_percentage}%)</span>
                        <Button size="sm" variant="outline" className="rounded-full h-8 hover:bg-[#EEF2FF] hover:text-[#4361EE]" onClick={() => navigate(`/student/results/${ex.attempt_id}`)} data-testid={`ex-result-${ex.id}`}><Eye className="h-3.5 w-3.5" /> Hasil</Button>
                      </div>
                    ) : (
                      <Button size="sm" className="w-full rounded-full h-8 bg-[#4361EE] hover:bg-[#344ED0]" onClick={() => navigate(`/student/exam/${ex.id}`)} data-testid={`ex-start-${ex.id}`}><PlayCircle className="h-3.5 w-3.5" /> Kerjakan</Button>
                    )}
                  </div>
                </div>
              ))}
              {data.exercises.length === 0 && <p className="text-sm text-[#94A3B8]">Belum ada latihan.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
