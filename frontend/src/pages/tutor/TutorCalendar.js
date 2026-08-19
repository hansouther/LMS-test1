import { CalendarCheck, Clock, MapPin } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";

export default function TutorCalendar() {
  const { data, loading } = useFetch("/tutor/calendar");

  return (
    <div data-testid="tutor-calendar">
      <PageHeader title="Kalender Mengajar" subtitle="Jadwal kelas yang sudah terkonfirmasi untuk Anda." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={CalendarCheck} title="Belum ada jadwal terkonfirmasi" desc="Menangkan job bidding untuk mengisi kalender Anda." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {data.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex items-center gap-5" data-testid={`cal-${s.id}`}>
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#4361EE] to-[#7C3AED] text-white flex flex-col items-center justify-center shrink-0">
                <span className="text-xl font-bold leading-none">{new Date(s.date).getDate()}</span>
                <span className="text-[10px] uppercase">{new Date(s.date).toLocaleDateString("id-ID", { month: "short" })}</span>
              </div>
              <div>
                <p className="font-semibold text-[#0A1128]">{s.title}</p>
                <p className="text-sm text-[#475569] mt-0.5">{s.subject}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {formatDate(s.date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
