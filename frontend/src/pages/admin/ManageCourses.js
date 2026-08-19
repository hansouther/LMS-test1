import { useState } from "react";
import { Plus, Pencil, Trash2, BookOpen, Users } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";

const EMPTY = { title: "", description: "", subject: "", level: "Umum", price: 0, thumbnail: "", active: true };

export default function ManageCourses() {
  const { data, loading, refetch } = useFetch("/admin/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ title: c.title, description: c.description, subject: c.subject, level: c.level, price: c.price, thumbnail: c.thumbnail || "", active: c.active }); setEditId(c.id); setOpen(true); };

  const save = async () => {
    const payload = { ...form, price: parseInt(form.price || 0, 10), thumbnail: form.thumbnail || null };
    try {
      if (editId) await api.put(`/admin/courses/${editId}`, payload);
      else await api.post("/admin/courses", payload);
      toast.success("Kursus tersimpan"); setOpen(false); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/courses/${id}`); toast.success("Kursus dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div data-testid="manage-courses">
      <PageHeader title="Manajemen Kursus" subtitle="Rilis penawaran kursus aktif untuk pendaftaran siswa."
        actions={<Button onClick={openNew} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-course-btn"><Plus className="h-4 w-4" /> Tambah Kursus</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={BookOpen} title="Belum ada kursus" action={<Button onClick={openNew} className="rounded-full bg-[#4361EE]"><Plus className="h-4 w-4" /> Tambah</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`course-${c.id}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#EEF2FF] text-[#4361EE] px-3 py-1 text-[11px] font-semibold">{c.subject}</span>
                <span className={`text-[11px] font-semibold ${c.active ? "text-[#10B981]" : "text-[#94A3B8]"}`}>{c.active ? "Aktif" : "Nonaktif"}</span>
              </div>
              <h3 className="mt-3 font-semibold text-[#0A1128]">{c.title}</h3>
              <p className="mt-1 text-sm text-[#475569] line-clamp-2">{c.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-[#94A3B8]">
                <span>{c.level}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.enrolled_count} terdaftar</span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-head font-bold text-[#4361EE]">{formatRupiah(c.price)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid={`edit-course-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                  <ConfirmButton onConfirm={() => del(c.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-course-${c.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Kursus" : "Tambah Kursus"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="course-title" /></div>
            <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={set("description")} className="mt-1.5" data-testid="course-desc" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mata Pelajaran</Label><Input value={form.subject} onChange={set("subject")} className="mt-1.5" data-testid="course-subject" /></div>
              <div><Label>Jenjang</Label><Input value={form.level} onChange={set("level")} className="mt-1.5" data-testid="course-level" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Harga (Rp)</Label><Input type="number" value={form.price} onChange={set("price")} className="mt-1.5" data-testid="course-price" /></div>
              <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 mt-6"><Label>Aktif</Label><Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} data-testid="course-active" /></div>
            </div>
            <div><Label>URL Thumbnail (opsional)</Label><Input value={form.thumbnail} onChange={set("thumbnail")} className="mt-1.5" placeholder="https://..." data-testid="course-thumbnail" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-course">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
