import WeaknessReportView from "@/components/common/WeaknessReportView";

export default function WeaknessReport() {
  return (
    <WeaknessReportView
      apiBase="/proctor"
      title="Analisis Kelemahan Siswa"
      subtitle="Rekap nilai per Try Out siswa sekolah Anda, titik terlemah (Numerasi/Literasi), dan analisis butir soal. Unduh CSV untuk laporan sekolah."
    />
  );
}
