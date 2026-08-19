import { Link } from "react-router-dom";
import { Gavel, CalendarCheck, Users, Library, Clock, Award } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";

export default function TutorDashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch("/tutor/dashboard");

  return (
    <div data-testid="tutor-dashboard">
      <PageHeader title={`Selamat datang, ${user?.name?.split(" ")[0]}`} subtitle="Ambil jadwal mengajar terbuka, kelola kelas, dan bagikan materi." />

      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={Gavel} label="Slot Terbuka" value={data.open_slots} accent="#FF9F1C" testid="stat-open-slots" />
            <StatCard icon={Award} label="Bidding Saya" value={data.my_bids} accent="#4361EE" testid="stat-my-bids" />
            <StatCard icon={CalendarCheck} label="Kelas Terkonfirmasi" value={data.confirmed_classes} accent="#10B981" testid="stat-confirmed" />
            <StatCard icon={Library} label="Materi Diunggah" value={data.my_materials} accent="#7C3AED" testid="stat-materials" />
          </div>

          <div className="mt-8 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128] mb-4 flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-[#4361EE]" /> Kelas Mendatang</h3>
              {data.upcoming?.length ? (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.upcoming.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between" data-testid={`upcoming-${s.id}`}>
                      <div>
                        <p className="font-medium text-[#0A1128] text-sm">{s.title}</p>
                        <p className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5"><Clock className="h-3.5 w-3.5" /> {s.start_time}-{s.end_time} · {s.subject}</p>
                      </div>
                      <span className="text-xs text-[#94A3B8]">{formatDate(s.date)}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty icon={CalendarCheck} title="Belum ada kelas" desc="Ikuti job bidding untuk mendapatkan jadwal." />}
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128] mb-3">Kualifikasi Anda</h3>
              <div className="flex flex-wrap gap-2">
                {(data.qualifications || []).map((q) => (
                  <span key={q} className="rounded-full bg-[#EEF2FF] text-[#4361EE] px-3 py-1.5 text-xs font-semibold">{q}</span>
                ))}
                {(!data.qualifications || data.qualifications.length === 0) && <p className="text-sm text-[#94A3B8]">Belum ada kualifikasi.</p>}
              </div>
              <Link to="/tutor/bidding" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#4361EE] hover:underline">Lihat slot terbuka →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
