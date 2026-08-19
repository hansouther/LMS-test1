import { Link } from "react-router-dom";
import {
  Users, GraduationCap, ShieldCheck, BookOpen, FileText, CalendarClock,
  Handshake, ClipboardCheck, ArrowRight, Newspaper, Radio,
} from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { Loading } from "@/components/common/States";

export default function AdminDashboard() {
  const { data, loading } = useFetch("/admin/stats");

  const quick = [
    ["Berita & Pengumuman", "/admin/news", Newspaper, "#4361EE"],
    ["Kursus & Jadwal", "/admin/schedule", CalendarClock, "#FF9F1C"],
    ["Bank Soal Try Out", "/admin/tryouts", FileText, "#10B981"],
    ["Broadcast Proktor", "/admin/broadcasts", Radio, "#7C3AED"],
  ];

  return (
    <div data-testid="admin-dashboard">
      <PageHeader title="Pusat Kendali" subtitle="Kelola seluruh ekosistem CendekiaLMS dari satu dasbor." />

      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={GraduationCap} label="Siswa" value={data.students} accent="#4361EE" testid="stat-students" />
            <StatCard icon={Users} label="Tentor" value={data.tutors} accent="#FF9F1C" testid="stat-tutors" />
            <StatCard icon={ShieldCheck} label="Proktor" value={data.proctors} accent="#7C3AED" testid="stat-proctors" />
            <StatCard icon={BookOpen} label="Kursus" value={data.courses} accent="#10B981" testid="stat-courses" />
            <StatCard icon={FileText} label="Try Out" value={data.tryouts} accent="#4361EE" testid="stat-tryouts" />
            <StatCard icon={CalendarClock} label="Slot Terbuka" value={data.open_slots} accent="#FF9F1C" testid="stat-slots" />
            <StatCard icon={Handshake} label="Kemitraan Baru" value={data.pending_partnerships} accent="#7C3AED" testid="stat-partnerships" />
            <StatCard icon={ClipboardCheck} label="Total Pengerjaan" value={data.total_attempts} accent="#10B981" testid="stat-attempts" />
          </div>

          <h2 className="mt-10 mb-4 font-semibold text-[#0A1128]">Aksi Cepat</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {quick.map(([label, to, Icon, color]) => (
              <Link key={to} to={to} className="group bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:-translate-y-1 transition-transform duration-200" data-testid={`quick-${to.split("/").pop()}`}>
                <div className="h-11 w-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}><Icon className="h-5 w-5" /></div>
                <p className="mt-4 font-semibold text-[#0A1128]">{label}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm text-[#4361EE] font-medium">Kelola <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" /></span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
