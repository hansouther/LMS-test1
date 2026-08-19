import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";

export default function CourseCatalog() {
  const { data, loading, refetch } = useFetch("/student/courses");
  const [busy, setBusy] = useState(null);

  const enroll = async (id) => {
    setBusy(id);
    try {
      await api.post(`/student/courses/${id}/enroll`);
      toast.success("Berhasil mendaftar kursus!");
      refetch();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="course-catalog">
      <PageHeader title="Katalog Kursus" subtitle="Pilih kursus aktif dan daftarkan diri Anda untuk mulai belajar." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={BookOpen} title="Belum ada kursus" desc="Kursus aktif akan ditampilkan di sini." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col hover:-translate-y-1 transition-transform duration-200" data-testid={`course-${c.id}`}>
              <div className="h-36 bg-gradient-to-br from-[#4361EE] to-[#7C3AED] relative">
                {c.thumbnail && <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />}
                <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#0A1128]">{c.subject}</span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <p className="text-xs text-[#94A3B8]">{c.level}</p>
                <h3 className="mt-1 font-semibold text-[#0A1128]">{c.title}</h3>
                <p className="mt-2 text-sm text-[#475569] line-clamp-2 flex-1">{c.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-head font-bold text-[#4361EE]">{formatRupiah(c.price)}</span>
                  {c.enrolled ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#10B981]" data-testid={`enrolled-${c.id}`}><CheckCircle2 className="h-4 w-4" /> Terdaftar</span>
                  ) : (
                    <Button onClick={() => enroll(c.id)} disabled={busy === c.id} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" size="sm" data-testid={`enroll-${c.id}`}>
                      {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Daftar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
