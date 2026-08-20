import { useState } from "react";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import DatePicker from "@/components/common/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const TYPES = [
  { v: "academic", l: "Akademik", c: "#0E7490" },
  { v: "exam", l: "Ujian", c: "#EF4444" },
  { v: "deadline", l: "Tenggat", c: "#C9A227" },
  { v: "holiday", l: "Libur", c: "#10B981" },
  { v: "event", l: "Acara", c: "#7C3AED" },
];
const EMPTY = { title: "", description: "", date: "", type: "academic" };

export default function ManageCalendar() {
  const { data, loading, refetch } = useFetch("/admin/calendar");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    if (!form.date) return toast.error("Pilih tanggal");
    try { await api.post("/admin/calendar", form); toast.success("Agenda ditambahkan"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/calendar/${id}`); toast.success("Agenda dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };
  const color = (t) => TYPES.find((x) => x.v === t)?.c || "#0E7490";
  const label = (t) => TYPES.find((x) => x.v === t)?.l || t;

  return (
    <div data-testid="manage-calendar">
      <PageHeader title="Kalender Akademik" subtitle="Sinkronkan agenda global yang tampil di landing page dan seluruh portal."
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-event-btn"><Plus className="h-4 w-4" /> Tambah Agenda</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={CalendarDays} title="Belum ada agenda" />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] divide-y divide-[#E2E8F0]">
          {data.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-4" data-testid={`event-${c.id}`}>
              <div className="h-12 w-12 rounded-lg flex flex-col items-center justify-center text-white shrink-0" style={{ backgroundColor: color(c.type) }}>
                <span className="text-sm font-bold leading-none">{new Date(c.date).getDate()}</span>
                <span className="text-[9px] uppercase">{new Date(c.date).toLocaleDateString("id-ID", { month: "short" })}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#0A1128] text-sm">{c.title}</p>
                <p className="text-xs text-[#94A3B8]">{c.description}</p>
              </div>
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ color: color(c.type), backgroundColor: `${color(c.type)}1A` }}>{label(c.type)}</span>
              <span className="text-xs text-[#94A3B8] hidden sm:block">{formatDate(c.date)}</span>
              <ConfirmButton onConfirm={() => del(c.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-event-${c.id}`}><Trash2 className="h-4 w-4" /></Button>} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Agenda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul Agenda</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="event-title" /></div>
            <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={set("description")} className="mt-1.5" data-testid="event-desc" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tanggal</Label><div className="mt-1.5"><DatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} testid="event-date" /></div></div>
              <div><Label>Tipe</Label>
                <Select value={form.type} onValueChange={set("type")}>
                  <SelectTrigger className="mt-1.5" data-testid="event-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-event">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
