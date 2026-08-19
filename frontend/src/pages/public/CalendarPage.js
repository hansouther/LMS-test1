import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import MonthCalendar from "@/components/public/MonthCalendar";
import useSeo from "@/hooks/useSeo";
import { Loading } from "@/components/common/States";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [serverNow, setServerNow] = useState(null);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: "Kalender Akademik — CendekiaLMS",
    description: "Kalender akademik bulanan CendekiaLMS: jadwal ujian, tenggat, libur, dan acara. Diperbarui otomatis mengikuti waktu server.",
  });

  useEffect(() => {
    Promise.all([
      api.get("/public/calendar").then((r) => setEvents(r.data)).catch(() => {}),
      api.get("/public/time").then((r) => setServerNow(r.data.iso)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <PublicShell>
      <section className="bg-[#0A1128] text-white py-16">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-4 py-1.5 text-xs font-semibold">
            <CalendarDays className="h-3.5 w-3.5 text-[#FF9F1C]" /> Kalender Akademik
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-tight">Agenda & Jadwal Akademik</h1>
          <p className="mt-4 text-white/70 max-w-2xl">Tampilan kalender bulanan lengkap. Lihat ujian, tenggat, libur, dan acara pada bulan berjalan — diperbarui otomatis mengikuti waktu server.</p>
        </div>
      </section>

      <section className="py-14 bg-[#F4F7FE]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8" data-testid="calendar-page">
          {loading ? <Loading /> : <MonthCalendar events={events} initialDate={serverNow} showList />}
        </div>
      </section>
    </PublicShell>
  );
}
