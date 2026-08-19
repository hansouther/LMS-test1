import { useState } from "react";
import { Plus, Pencil, Trash2, Newspaper } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const EMPTY = { title: "", content: "", category: "Pengumuman", published: true };
const CATS = ["Pengumuman", "Berita", "Update", "Acara"];

export default function ManageNews() {
  const { data, loading, refetch } = useFetch("/admin/news");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (n) => { setForm({ title: n.title, content: n.content, category: n.category, published: n.published }); setEditId(n.id); setOpen(true); };

  const save = async () => {
    try {
      if (editId) await api.put(`/admin/news/${editId}`, form);
      else await api.post("/admin/news", form);
      toast.success("Berita tersimpan");
      setOpen(false); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/news/${id}`); toast.success("Berita dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div data-testid="manage-news">
      <PageHeader title="Berita & Pengumuman" subtitle="Kelola konten yang tampil di landing page publik."
        actions={<Button onClick={openNew} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-news-btn"><Plus className="h-4 w-4" /> Tambah Berita</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={Newspaper} title="Belum ada berita" action={<Button onClick={openNew} className="rounded-full bg-[#4361EE]"><Plus className="h-4 w-4" /> Tambah</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {data.map((n) => (
            <div key={n.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`news-${n.id}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#EEF2FF] text-[#4361EE] px-3 py-1 text-[11px] font-semibold">{n.category}</span>
                <span className={`text-[11px] font-semibold ${n.published ? "text-[#10B981]" : "text-[#94A3B8]"}`}>{n.published ? "Terbit" : "Draft"}</span>
              </div>
              <h3 className="mt-3 font-semibold text-[#0A1128]">{n.title}</h3>
              <p className="mt-1.5 text-sm text-[#475569] line-clamp-2">{n.content}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[#94A3B8]">{formatDate(n.created_at)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(n)} data-testid={`edit-news-${n.id}`} className="hover:bg-[#EEF2FF] hover:text-[#4361EE]"><Pencil className="h-4 w-4" /></Button>
                  <ConfirmButton onConfirm={() => del(n.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-news-${n.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Berita" : "Tambah Berita"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="news-title" /></div>
            <div><Label>Kategori</Label>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger className="mt-1.5" data-testid="news-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Isi</Label><Textarea value={form.content} onChange={set("content")} rows={5} className="mt-1.5" data-testid="news-content" /></div>
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3">
              <Label>Terbitkan ke publik</Label>
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} data-testid="news-published" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-news">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
