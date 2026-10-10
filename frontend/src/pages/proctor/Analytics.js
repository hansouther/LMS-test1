import { TrendingUp, TrendingDown, Minus, BarChart3, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";

const PALETTE = ["#0E7490", "#C9A227", "#10B981", "#7C3AED", "#EF4444", "#0EA5E9", "#EC4899"];
const DIR = {
  up: { icon: TrendingUp, c: "#10B981", l: "Meningkat" },
  down: { icon: TrendingDown, c: "#EF4444", l: "Menurun" },
  flat: { icon: Minus, c: "#94A3B8", l: "Stabil" },
};

export default function Analytics() {
  const { data, loading } = useFetch("/proctor/analytics");

  if (loading) return <Loading />;
  const perStudent = data?.per_student || [];
  const classTrend = data?.class_trend || [];

  const labels = classTrend.map((c) => c.tryout);
  const multiData = labels.map((label) => {
    const row = { tryout: label };
    perStudent.forEach((s) => {
      const pt = s.trend.find((t) => t.tryout === label);
      if (pt) row[s.name] = pt.percentage;
    });
    return row;
  });

  return (
    <div data-testid="proctor-analytics">
      <PageHeader title="Analitik Performa" subtitle="Tren kenaikan & penurunan performa siswa sekolah Anda dari waktu ke waktu." />

      {perStudent.length === 0 ? (
        <Empty icon={BarChart3} title="Belum ada data" desc="Data analitik muncul setelah siswa mengerjakan Try Out." />
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128] mb-4">Rata-rata Nilai Kelas per Try Out</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={classTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="tryout" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Bar dataKey="avg" name="Rata-rata (%)" fill="#0E7490" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128] mb-4">Tren Performa per Siswa</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={multiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="tryout" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {perStudent.map((s, i) => (
                    <Line key={s.student_id} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h2 className="mt-8 mb-4 font-semibold text-[#0A1128] flex items-center gap-2"><Users className="h-5 w-5 text-[#0E7490]" /> Ringkasan per Siswa</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {perStudent.map((s) => {
              const d = DIR[s.direction] || DIR.flat;
              return (
                <div key={s.student_id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`analytics-${s.student_id}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#0A1128]">{s.name}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: d.c }}><d.icon className="h-4 w-4" /> {d.l}</span>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="font-mono2 text-3xl font-bold text-[#0A1128]">{s.avg ?? "-"}</span>
                    <span className="text-xs text-[#94A3B8] mb-1">rata-rata</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {s.trend.map((t, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="h-16 bg-[#EFF6F8] rounded-lg relative overflow-hidden flex items-end">
                          <div className="w-full rounded-t-lg" style={{ height: `${t.percentage}%`, backgroundColor: t.percentage >= 70 ? "#10B981" : t.percentage >= 50 ? "#C9A227" : "#EF4444" }} />
                        </div>
                        <p className="mt-1 text-[10px] font-mono2 text-[#475569]">{t.percentage}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
