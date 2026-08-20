import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight, GraduationCap, Sparkles } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import useSeo from "@/hooks/useSeo";
import { Loading, Empty } from "@/components/common/States";
import { formatRupiah } from "@/lib/format";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: "Katalog Kursus — CendekiaLMS",
    description: "Jelajahi kursus interaktif CendekiaLMS: video pembelajaran, latihan soal bernilai, dan Try Out CBT. Daftar gratis untuk mulai belajar.",
  });

  useEffect(() => {
    api.get("/public/courses").then((r) => setCourses(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <PublicShell>
      <section className="bg-[#0A1128] text-white py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-4 py-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[#FF9F1C]" /> Katalog Kursus
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-tight">Belajar dari kursus interaktif terbaik</h1>
          <p className="mt-4 text-white/70 max-w-2xl">Setiap kursus memuat video pembelajaran, materi PDF, dan latihan soal dengan penilaian otomatis. Daftar gratis untuk mulai belajar.</p>
          <Link to="/register" className="inline-flex items-center gap-2 mt-6 rounded-full bg-[#FF9F1C] hover:bg-[#e88f10] text-[#0A1128] font-semibold px-6 py-3 transition-colors duration-200" data-testid="courses-hero-cta">
            Daftar & Mulai Belajar <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="py-14 bg-[#F4F7FE]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8" data-testid="public-courses">
          {loading ? <Loading /> : courses.length === 0 ? (
            <Empty icon={BookOpen} title="Belum ada kursus" desc="Kursus aktif akan tampil di sini." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col hover:-translate-y-1 transition-transform duration-200" data-testid={`public-course-${c.id}`}>
                  <Link to={`/kursus/${c.id}`} className="block">
                    <div className="h-36 bg-gradient-to-br from-[#4361EE] to-[#7C3AED] relative">
                      {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}
                      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#0A1128]">{c.subject}</span>
                    </div>
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-xs text-[#94A3B8]">{c.level}</p>
                    <Link to={`/kursus/${c.id}`}><h3 className="mt-1 font-semibold text-[#0A1128] hover:text-[#4361EE] transition-colors duration-200">{c.title}</h3></Link>
                    <p className="mt-2 text-sm text-[#475569] line-clamp-3 flex-1">{c.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-head font-bold text-[#4361EE]">{formatRupiah(parseInt(c.price || 0, 10))}</span>
                      <Link to={`/kursus/${c.id}`}><span className="inline-flex items-center gap-1.5 rounded-full bg-[#4361EE] hover:bg-[#344ED0] text-white text-sm font-medium px-4 py-2 transition-colors duration-200" data-testid={`public-course-cta-${c.id}`}>Lihat Detail <ArrowRight className="h-3.5 w-3.5" /></span></Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 rounded-2xl bg-white border border-[#E2E8F0] p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center"><GraduationCap className="h-6 w-6" /></div>
              <div>
                <h3 className="font-semibold text-[#0A1128]">Sudah punya akun?</h3>
                <p className="text-sm text-[#475569]">Masuk untuk melanjutkan belajar dan mendaftar kursus.</p>
              </div>
            </div>
            <Link to="/login"><span className="inline-flex items-center gap-2 rounded-full border border-[#CBD5E1] hover:bg-[#EEF2FF] hover:text-[#4361EE] text-[#475569] font-medium px-6 py-2.5 transition-colors duration-200" data-testid="courses-login-cta">Masuk Portal</span></Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
