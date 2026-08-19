import { Download, FileSpreadsheet } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export default function Reports() {
  const { data, loading } = useFetch("/proctor/reports");

  const download = async () => {
    try {
      const res = await api.get("/proctor/reports/csv", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = "laporan_nilai.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Laporan diunduh");
    } catch { toast.error("Gagal mengunduh laporan"); }
  };

  return (
    <div data-testid="proctor-reports">
      <PageHeader title="Laporan Nilai" subtitle="Tarik hasil Try Out & latihan soal siswa sekolah Anda."
        actions={<Button onClick={download} disabled={!data?.length} className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="download-csv"><Download className="h-4 w-4" /> Unduh CSV</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={FileSpreadsheet} title="Belum ada nilai" desc="Laporan muncul setelah siswa mengerjakan Try Out." />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F4F7FE]">
                <TableHead>Siswa</TableHead>
                <TableHead>Try Out</TableHead>
                <TableHead className="hidden sm:table-cell">Mapel</TableHead>
                <TableHead>Skor</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead className="hidden md:table-cell">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={i} data-testid={`report-row-${i}`}>
                  <TableCell className="font-medium text-[#0A1128]">{r.student_name}</TableCell>
                  <TableCell>{r.tryout_title}</TableCell>
                  <TableCell className="hidden sm:table-cell text-[#475569]">{r.subject}</TableCell>
                  <TableCell className="font-mono2">{r.score}/{r.max_score}</TableCell>
                  <TableCell><span className="font-mono2 font-bold" style={{ color: r.percentage >= 70 ? "#10B981" : r.percentage >= 50 ? "#FF9F1C" : "#EF4444" }}>{r.percentage}%</span></TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-[#94A3B8]">{formatDateTime(r.submitted_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
