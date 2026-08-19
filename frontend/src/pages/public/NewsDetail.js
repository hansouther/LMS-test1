import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, User, CalendarDays } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setNotFound(false);
    api.get(`/public/news/${id}`)
      .then((r) => { setItem(r.data); document.title = `${r.data.title} — CendekiaLMS`; })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PublicShell>
      <section className="py-14">
        <div className="max-w-3xl mx-auto px-5 sm:px-8" data-testid="news-detail">
          <button onClick={() => navigate("/berita")} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#4361EE] mb-6 transition-colors duration-200" data-testid="news-back">
            <ArrowLeft className="h-4 w-4" /> Semua Berita
          </button>

          {loading ? <Loading /> : notFound || !item ? (
            <Empty icon={Newspaper} title="Berita tidak ditemukan" desc="Berita mungkin telah dihapus atau tautan tidak valid." />
          ) : (
            <article>
              <span className="inline-block rounded-full bg-[#EEF2FF] text-[#4361EE] px-3 py-1 text-xs font-semibold" data-testid="news-detail-category">{item.category}</span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight text-[#0A1128]" data-testid="news-detail-title">{item.title}</h1>
              <div className="mt-4 flex items-center gap-4 text-sm text-[#94A3B8]">
                <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {item.author || "Redaksi"}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDate(item.created_at)}</span>
              </div>
              <div className="mt-8 prose prose-slate max-w-none text-[#334155] leading-relaxed whitespace-pre-line text-[15px]" data-testid="news-detail-content">
                {item.content}
              </div>
            </article>
          )}

          <div className="mt-12 rounded-2xl bg-[#0A1128] text-white p-8 text-center">
            <h3 className="text-xl font-bold">Ingin ikut belajar di CendekiaLMS?</h3>
            <p className="mt-2 text-white/70 text-sm">Daftar gratis dan akses Try Out, kursus interaktif, serta pemantauan progres belajar.</p>
            <Link to="/register" className="inline-flex items-center gap-2 mt-5 rounded-full bg-[#FF9F1C] hover:bg-[#e88f10] text-[#0A1128] font-semibold px-6 py-3 transition-colors duration-200" data-testid="news-detail-cta">
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
