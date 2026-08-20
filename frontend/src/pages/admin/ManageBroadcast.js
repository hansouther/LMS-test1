import { useState } from "react";
import { Plus, Trash2, Radio, AlertTriangle } from "lucide-react";
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
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const EMPTY = { title: "", message: "", priority: "normal" };

export default function ManageBroadcast() {
  const { data, loading, refetch } = useFetch("/admin/broadcasts");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    try { await api.post("/admin/broadcasts", form); toast.success("Broadcast terkirim ke portal Proktor"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/broadcasts/${id}`); toast.success("Broadcast dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div data-testid="manage-broadcast">
      <PageHeader title="Broadcast ke Proktor" subtitle="Siarkan informasi khusus yang tampil langsung di halaman Proktor sekolah mitra."
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-broadcast-btn"><Plus className="h-4 w-4" /> Broadcast Baru</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={Radio} title="Belum ada broadcast" />
      ) : (
        <div className="space-y-4">
          {data.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`broadcast-${b.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {b.priority === "high" && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-[11px] font-semibold"><AlertTriangle className="h-3 w-3" /> Prioritas Tinggi</span>}
                    <h3 className="font-semibold text-[#0A1128]">{b.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm text-[#475569]">{b.message}</p>
                  <p className="mt-2 text-xs text-[#94A3B8]">{formatDateTime(b.created_at)} · {b.author}</p>
                </div>
                <ConfirmButton onConfirm={() => del(b.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-broadcast-${b.id}`}><Trash2 className="h-4 w-4" /></Button>} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Broadcast Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="broadcast-title" /></div>
            <div><Label>Pesan</Label><Textarea value={form.message} onChange={set("message")} rows={4} className="mt-1.5" data-testid="broadcast-message" /></div>
            <div><Label>Prioritas</Label>
              <Select value={form.priority} onValueChange={set("priority")}>
                <SelectTrigger className="mt-1.5" data-testid="broadcast-priority"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Tinggi</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-broadcast">Siarkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
