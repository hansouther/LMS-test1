import { ClipboardCheck, TrendingUp } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProctorAttendance() {
  const { data, loading } = useFetch("/proctor/attendance");
  const rateColor = (r) => r >= 80 ? "#10B981" : r >= 50 ? "#C9A227" : "#EF4444";

  return (
    <div data-testid="proctor-attendance">
      <PageHeader title="Rekap Kehadiran Siswa" subtitle="Persentase kehadiran siswa sekolah Anda lintas seluruh pertemuan kelas." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={ClipboardCheck} title="Belum ada data kehadiran" desc="Data muncul setelah siswa mengikuti kelas dengan presensi." />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#EFF6F8]">
                <TableHead>Siswa</TableHead>
                <TableHead className="hidden sm:table-cell">Kelas</TableHead>
                <TableHead>Hadir / Total</TableHead>
                <TableHead className="w-48">Tingkat Kehadiran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.student_id} data-testid={`attendance-row-${r.student_id}`}>
                  <TableCell className="font-medium text-[#0A1128]">{r.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-[#475569]">{r.grade || "-"}</TableCell>
                  <TableCell className="text-sm text-[#475569]">{r.attended} / {r.total_sessions}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.rate}%`, backgroundColor: rateColor(r.rate) }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right" style={{ color: rateColor(r.rate) }} data-testid={`attendance-rate-${r.student_id}`}>{r.rate}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
