import { useState } from "react";
import { Plus, Trash2, Library, Lock, Globe, FileText } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const EMPTY = { title: "", description: "", content: "", subject: "", visibility: "public", course_id: "" };

export default function TutorMaterials() {
  const { data, loading, refetch } = useFetch("/tutor/materials");
  const { data: courses } = useFetch("/tutor/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    if (form.visibility === "private" && !form.course_id) return toast.error("Materi privat wajib dikaitkan ke kursus");
    const payload = { ...form, course_id: form.course_id || null };
    try { await api.post("/tutor/materials", payload); toast.success("Materi diunggah"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/tutor/materials/${id}`); toast.success("Materi dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div data-testid="tutor-materials">
      <PageHeader title="Materi Ajar" subtitle="Unggah materi publik untuk semua siswa atau privat khusus kursus kelas Anda."
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-material-btn"><Plus className="h-4 w-4" /> Unggah Materi</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={Library} title="Belum ada materi" action={<Button onClick={() => setOpen(true)} className="rounded-full bg-[#4361EE]"><Plus className="h-4 w-4" /> Unggah</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`material-${m.id}`}>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center"><FileText className="h-5 w-5" /></div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.visibility === "private" ? "bg-[#FFF4E5] text-[#FF9F1C]" : "bg-[#ECFDF5] text-[#10B981]"}`}>
                  {m.visibility === "private" ? <><Lock className="h-3 w-3" /> Privat</> : <><Globe className="h-3 w-3" /> Publik</>}
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-[#0A1128]">{m.title}</h3>
              <p className="mt-1 text-sm text-[#475569] line-clamp-2">{m.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[#94A3B8]">{m.subject || "Umum"}</span>
                <ConfirmButton onConfirm={() => del(m.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-material-${m.id}`}><Trash2 className="h-4 w-4" /></Button>} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Unggah Materi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="material-title" /></div>
            <div><Label>Deskripsi</Label><Input value={form.description} onChange={set("description")} className="mt-1.5" data-testid="material-desc" /></div>
            <div><Label>Konten / Ringkasan</Label><Textarea value={form.content} onChange={set("content")} rows={4} className="mt-1.5" data-testid="material-content" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mata Pelajaran</Label><Input value={form.subject} onChange={set("subject")} className="mt-1.5" data-testid="material-subject" /></div>
              <div><Label>Visibilitas</Label>
                <Select value={form.visibility} onValueChange={set("visibility")}>
                  <SelectTrigger className="mt-1.5" data-testid="material-visibility"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="public">Publik (semua siswa)</SelectItem><SelectItem value="private">Privat (kursus tertentu)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {form.visibility === "private" && (
              <div><Label>Kaitkan Kursus</Label>
                <Select value={form.course_id} onValueChange={set("course_id")}>
                  <SelectTrigger className="mt-1.5" data-testid="material-course"><SelectValue placeholder="Pilih kursus" /></SelectTrigger>
                  <SelectContent>{(courses || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-material">Unggah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
