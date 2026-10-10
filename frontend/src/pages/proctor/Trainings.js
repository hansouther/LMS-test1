import { BookOpen, Users, GraduationCap } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";

export default function ProctorTrainings() {
  const { data, loading } = useFetch("/proctor/trainings");

  return (
    <div data-testid="proctor-trainings">
      <PageHeader title="Kegiatan Pelatihan Siswa" subtitle="Pantau kursus & pelatihan yang diikuti siswa sekolah Anda." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={BookOpen} title="Belum ada kegiatan" desc="Belum ada siswa sekolah Anda yang mengikuti kursus/pelatihan." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map((t) => (
            <div key={t.course_id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col" data-testid={`training-${t.course_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-[#E6F5F8] text-[#0E7490] px-2.5 py-0.5 text-[11px] font-semibold">{t.subject}</span>
                  <h3 className="mt-2 font-semibold text-[#0A1128] leading-snug">{t.title}</h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{t.level}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0"><BookOpen className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-[#475569]">
                <Users className="h-4 w-4 text-[#0E7490]" /> <span className="font-semibold text-[#0A1128]">{t.participants}</span> siswa mengikuti
              </div>
              <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-1.5">
                {t.students.slice(0, 8).map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6F8] px-2.5 py-1 text-[11px] text-[#475569]" data-testid={`training-student-${t.course_id}-${i}`}>
                    <GraduationCap className="h-3 w-3 text-[#94A3B8]" /> {name}
                  </span>
                ))}
                {t.students.length > 8 && <span className="text-[11px] text-[#94A3B8] px-1 py-1">+{t.students.length - 8} lainnya</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
