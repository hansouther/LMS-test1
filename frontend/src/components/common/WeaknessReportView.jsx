import { Download, Target, TrendingUp, TrendingDown, Minus, ClipboardList, Users, BookOpen, Sparkles } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const COMP_COLOR = { Numerasi: "#4361EE", Literasi: "#FF9F1C" };
const scoreColor = (p) => (p >= 70 ? "#10B981" : p >= 40 ? "#FF9F1C" : "#EF4444");
const TREND = {
  naik: { icon: TrendingUp, c: "#10B981", l: "Naik" },
  turun: { icon: TrendingDown, c: "#EF4444", l: "Turun" },
  stabil: { icon: Minus, c: "#94A3B8", l: "Stabil" },
};

function StatCard({ label, value, suffix, color, testid, hint }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5" data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-2 font-mono2 text-3xl font-bold" style={{ color: color || "#0A1128" }}>
        {value}<span className="text-lg">{suffix}</span>
      </p>
      {hint && <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

export default function WeaknessReportView({ apiBase, title, subtitle }) {
  const { data, loading } = useFetch(`${apiBase}/analysis`);

  const download = async (endpoint, filename) => {
    try {
      const res = await api.get(`${apiBase}/analysis/${endpoint}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Berkas CSV diunduh");
    } catch { toast.error("Gagal mengunduh berkas"); }
  };

  if (loading) return <Loading />;

  const summary = data?.summary || {};
  const recap = data?.recap || [];
  const items = data?.items || [];
  const subjectAvg = summary.subject_avg || {};
  const comp = summary.competency_avg || {};
  const hasData = (summary.total_attempts || 0) > 0;

  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={() => download("scores.csv", "nilai_siswa.csv")} disabled={!hasData} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="download-scores-csv"><Download className="h-4 w-4" /> Nilai per Try Out</Button>
      <Button onClick={() => download("recap.csv", "rekap_kelemahan_siswa.csv")} disabled={!hasData} className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="download-recap-csv"><Download className="h-4 w-4" /> Rekap Kelemahan</Button>
      <Button onClick={() => download("items.csv", "analisis_butir_soal.csv")} disabled={!hasData} variant="outline" className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="download-items-csv"><Download className="h-4 w-4" /> Analisis Butir</Button>
    </div>
  );

  return (
    <div data-testid="weakness-report">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />

      {!hasData ? (
        <Empty icon={Target} title="Belum ada data nilai" desc="Analisis kelemahan muncul setelah siswa mengerjakan Try Out atau latihan soal." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Siswa" value={summary.total_students} testid="sum-students" hint={`${summary.total_attempts} pengerjaan`} />
            <StatCard label="Rata-rata Kelas" value={summary.class_avg} suffix="%" color={scoreColor(summary.class_avg)} testid="sum-class-avg" />
            <StatCard label="Numerasi" value={comp.numerasi ?? "—"} suffix={comp.numerasi != null ? "%" : ""} color={comp.numerasi != null ? scoreColor(comp.numerasi) : "#94A3B8"} testid="sum-numerasi" />
            <StatCard label="Literasi" value={comp.literasi ?? "—"} suffix={comp.literasi != null ? "%" : ""} color={comp.literasi != null ? scoreColor(comp.literasi) : "#94A3B8"} testid="sum-literasi" />
          </div>

          {/* Weakness highlight */}
          <div className="mt-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="weakness-highlight">
            <Target className="h-6 w-6 text-[#EF4444] shrink-0" />
            <p className="text-sm text-[#0A1128]">
              Titik terlemah sekolah: <span className="font-bold text-[#EF4444]">{summary.weakest_competency || "-"}</span>
              {summary.weakest_subject && <> pada mata pelajaran <span className="font-bold text-[#EF4444]">{summary.weakest_subject}</span></>}. Fokuskan pendampingan di area ini.
            </p>
          </div>

          {/* Per-subject bars */}
          <div className="mt-6 bg-white rounded-2xl border border-[#E2E8F0] p-6">
            <h3 className="font-semibold text-[#0A1128] mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#4361EE]" /> Rata-rata per Mata Pelajaran</h3>
            <div className="space-y-3" data-testid="subject-bars">
              {Object.entries(subjectAvg).sort((a, b) => a[1] - b[1]).map(([subj, avg]) => (
                <div key={subj} className="flex items-center gap-3" data-testid={`subject-bar-${subj}`}>
                  <span className="w-32 text-sm text-[#475569] truncate">{subj}</span>
                  <div className="flex-1 h-6 bg-[#F4F7FE] rounded-lg overflow-hidden">
                    <div className="h-full rounded-lg flex items-center justify-end pr-2" style={{ width: `${Math.max(avg, 6)}%`, backgroundColor: scoreColor(avg) }}>
                      <span className="text-[11px] font-mono2 font-bold text-white">{avg}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-student recap */}
          <h2 className="mt-8 mb-4 font-semibold text-[#0A1128] flex items-center gap-2"><Users className="h-5 w-5 text-[#4361EE]" /> Rekap Kelemahan per Siswa</h2>
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F4F7FE]">
                  <TableHead>Siswa</TableHead>
                  <TableHead className="hidden md:table-cell">Sekolah</TableHead>
                  <TableHead>Rata-rata</TableHead>
                  <TableHead>Numerasi</TableHead>
                  <TableHead>Literasi</TableHead>
                  <TableHead>Terlemah</TableHead>
                  <TableHead className="hidden sm:table-cell">Tren</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.map((r, i) => {
                  const t = TREND[r.trend] || TREND.stabil;
                  return (
                    <TableRow key={r.student_id} data-testid={`recap-row-${i}`}>
                      <TableCell className="font-medium text-[#0A1128]">{r.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-[#475569] text-sm">{r.school_name}</TableCell>
                      <TableCell><span className="font-mono2 font-bold" style={{ color: scoreColor(r.avg_percentage) }}>{r.avg_percentage}%</span></TableCell>
                      <TableCell className="font-mono2">{r.numerasi_pct != null ? `${r.numerasi_pct}%` : "—"}</TableCell>
                      <TableCell className="font-mono2">{r.literasi_pct != null ? `${r.literasi_pct}%` : "—"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${COMP_COLOR[r.weakest_competency] || "#94A3B8"}1A`, color: COMP_COLOR[r.weakest_competency] || "#64748B" }}>
                          {r.weakest_competency}
                        </span>
                        <span className="ml-1 text-xs text-[#94A3B8]">/ {r.weakest_subject}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: t.c }}><t.icon className="h-4 w-4" /> {t.l}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Item analysis — hardest questions */}
          <h2 className="mt-8 mb-4 font-semibold text-[#0A1128] flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#4361EE]" /> Analisis Butir Soal (paling sulit)</h2>
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F4F7FE]">
                  <TableHead className="min-w-[240px]">Soal</TableHead>
                  <TableHead className="hidden md:table-cell">Mapel</TableHead>
                  <TableHead>Kompetensi</TableHead>
                  <TableHead>% Benar</TableHead>
                  <TableHead>Kesulitan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 15).map((it, i) => (
                  <TableRow key={i} data-testid={`item-row-${i}`}>
                    <TableCell className="text-sm text-[#0A1128]">{it.text || `Soal #${it.order}`}</TableCell>
                    <TableCell className="hidden md:table-cell text-[#475569] text-sm">{it.subject}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${COMP_COLOR[it.competency] || "#94A3B8"}1A`, color: COMP_COLOR[it.competency] || "#64748B" }}>{it.competency}</span>
                    </TableCell>
                    <TableCell><span className="font-mono2 font-bold" style={{ color: scoreColor(it.correct_pct) }}>{it.correct_pct}%</span> <span className="text-xs text-[#94A3B8]">({it.correct_count}/{it.answered_count})</span></TableCell>
                    <TableCell><span className="text-xs font-semibold" style={{ color: scoreColor(it.correct_pct) }}>{it.difficulty}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Recommendations per student */}
          <h2 className="mt-8 mb-4 font-semibold text-[#0A1128] flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#4361EE]" /> Rekomendasi Latihan per Siswa</h2>
          {(() => {
            const withRec = recap.filter((r) => r.recommendations && ((r.recommendations.exercises?.length || 0) + (r.recommendations.courses?.length || 0) > 0));
            if (!withRec.length) return <p className="text-sm text-[#94A3B8]">Belum ada rekomendasi latihan yang cocok. Tambahkan kursus/latihan pada mata pelajaran terkait.</p>;
            return (
              <div className="grid md:grid-cols-2 gap-4" data-testid="recommendations-section">
                {withRec.map((r, i) => (
                  <div key={r.student_id} className="bg-white rounded-xl border border-[#E2E8F0] p-4" data-testid={`rec-student-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#0A1128] truncate">{r.name}</p>
                      <span className="text-xs text-[#94A3B8] shrink-0">{r.weakest_subject} · {r.weakest_competency}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.recommendations.exercises?.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] text-[#4361EE] px-2.5 py-0.5 text-[11px] font-medium"><ClipboardList className="h-3 w-3" /> {t.title}</span>
                      ))}
                      {r.recommendations.courses?.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] text-[#10B981] px-2.5 py-0.5 text-[11px] font-medium"><BookOpen className="h-3 w-3" /> {c.title}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
