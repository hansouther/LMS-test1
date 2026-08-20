import WeaknessReportView from "@/components/common/WeaknessReportView";

export default function AdminAnalysis() {
  return (
    <WeaknessReportView
      apiBase="/admin"
      title="Analisis Nilai & Kelemahan Siswa"
      subtitle="Rekap nilai per Try Out lintas sekolah, area terlemah (Numerasi/Literasi), dan analisis butir soal. Unduh CSV untuk pelaporan."
    />
  );
}
