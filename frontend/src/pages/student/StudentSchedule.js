import { CalendarCheck, Clock, User } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";

export default function StudentSchedule() {
  const { data, loading } = useFetch("/student/schedule");

  return (
    <div data-testid="student-schedule">
      <PageHeader title="Jadwal Saya" subtitle="Kelas terkonfirmasi dari tentor untuk kursus yang Anda ikuti." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={CalendarCheck} title="Belum ada jadwal" desc="Jadwal kelas akan muncul setelah tentor dikonfirmasi." />
      ) : (
        <div className="space-y-4">
          {data.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex items-center gap-5" data-testid={`schedule-${s.id}`}>
              <div className="h-14 w-14 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex flex-col items-center justify-center shrink-0">
                <span className="text-lg font-bold leading-none">{new Date(s.date).getDate()}</span>
                <span className="text-[10px] uppercase">{new Date(s.date).toLocaleDateString("id-ID", { month: "short" })}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#0A1128]">{s.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
                  <span>{s.subject}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {s.tutor_name}</span>
                </div>
              </div>
              <span className="text-xs font-medium text-[#94A3B8] hidden sm:block">{formatDate(s.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
