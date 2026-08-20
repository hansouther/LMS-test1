import { Link } from "react-router-dom";
import { Users, ClipboardCheck, Trophy, Radio, MonitorPlay, BarChart3, Download, AlertTriangle, Activity, Star } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { Loading, Empty } from "@/components/common/States";
import { formatDateTime } from "@/lib/format";

export default function ProctorDashboard() {
  const { data, loading } = useFetch("/proctor/dashboard");
  const { data: broadcasts } = useFetch("/proctor/broadcasts");
  const { data: favorites } = useFetch("/proctor/favorites");

  const quick = [
    ["Live Monitoring", "/proctor/monitoring", MonitorPlay, "#0E7490"],
    ["Analitik Performa", "/proctor/analytics", BarChart3, "#7C3AED"],
    ["Laporan Nilai", "/proctor/reports", Download, "#10B981"],
  ];

  return (
    <div data-testid="proctor-dashboard">
      <PageHeader title="Portal Proktor" subtitle={data?.school ? `Memantau siswa dari ${data.school.name}` : "Pemantau sekolah mitra"} />

      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={Users} label="Total Siswa" value={data.total_students} accent="#0E7490" testid="stat-students" />
            <StatCard icon={ClipboardCheck} label="Total Pengerjaan" value={data.total_attempts} accent="#C9A227" testid="stat-attempts" />
            <StatCard icon={Trophy} label="Rata-rata Nilai" value={`${data.avg_score}`} hint="dari 100" accent="#10B981" testid="stat-avg" />
            <StatCard icon={Activity} label="Aktif Sekarang" value={data.active_now} hint="sedang mengerjakan" accent="#7C3AED" testid="stat-active" />
          </div>

          <div className="mt-8 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="font-semibold text-[#0A1128] mb-4">Akses Cepat</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {quick.map(([label, to, Icon, color]) => (
                  <Link key={to} to={to} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:-translate-y-1 transition-transform duration-200" data-testid={`quick-${to.split("/").pop()}`}>
                    <div className="h-11 w-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}><Icon className="h-5 w-5" /></div>
                    <p className="mt-3 font-semibold text-sm text-[#0A1128]">{label}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128] mb-3 flex items-center gap-2"><Radio className="h-5 w-5 text-[#0E7490]" /> Informasi dari Admin</h3>
              {broadcasts?.length ? (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`broadcast-${b.id}`}>
                      <div className="flex items-center gap-2">
                        {b.priority === "high" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        <p className="font-semibold text-sm text-[#0A1128]">{b.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-[#475569]">{b.message}</p>
                      <p className="mt-1 text-[10px] text-[#94A3B8]">{formatDateTime(b.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : <Empty icon={Radio} title="Belum ada broadcast" />}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-[#E2E8F0] p-6">
            <h3 className="font-semibold text-[#0A1128] mb-3 flex items-center gap-2"><Star className="h-5 w-5 text-[#C9A227]" fill="#C9A227" /> Siswa Unggulan (Favorit Tentor)</h3>
            <p className="text-sm text-[#94A3B8] mb-4">Siswa yang ditandai tentor memiliki peluang tinggi untuk berhasil.</p>
            {favorites?.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favorites.map((f) => (
                  <div key={f.id} className="rounded-xl border border-[#E2E8F0] p-4" data-testid={`fav-${f.id}`}>
                    <div className="flex items-center gap-2"><Star className="h-4 w-4 text-[#C9A227]" fill="#C9A227" /><p className="font-semibold text-sm text-[#0A1128]">{f.student_name}</p></div>
                    <p className="text-xs text-[#94A3B8] mt-1">{f.course_title} · oleh {f.tutor_name}</p>
                    {f.note && <p className="mt-2 text-sm text-[#475569] rounded-lg bg-[#FBF6E9] p-2 italic">"{f.note}"</p>}
                  </div>
                ))}
              </div>
            ) : <Empty icon={Star} title="Belum ada siswa unggulan" desc="Tentor belum menandai siswa unggulan di sekolah Anda." />}
          </div>
        </>
      )}
    </div>
  );
}
