import { useState } from "react";
import { Plus, Trash2, CalendarClock, Gavel, CheckCircle2, Clock, User } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const EMPTY = { title: "", subject: "", date: "", start_time: "", end_time: "", required_qualifications: "", course_id: "", open_to_all: false, notes: "" };
const STATUS = { open: { l: "Terbuka", c: "#FF9F1C", bg: "#FFF4E5" }, confirmed: { l: "Terkonfirmasi", c: "#10B981", bg: "#ECFDF5" } };

export default function ManageSchedule() {
  const { data: slots, loading, refetch } = useFetch("/admin/slots");
  const { data: courses } = useFetch("/admin/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [bidsFor, setBidsFor] = useState(null);
  const [bids, setBids] = useState([]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    if (!form.date) return toast.error("Pilih tanggal");
    const payload = {
      ...form,
      required_qualifications: form.required_qualifications.split(",").map((s) => s.trim()).filter(Boolean),
      course_id: form.course_id || null,
    };
    try { await api.post("/admin/slots", payload); toast.success("Slot jadwal dibuka"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/slots/${id}`); toast.success("Slot dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  const viewBids = async (slot) => {
    setBidsFor(slot);
    try { const { data } = await api.get(`/admin/slots/${slot.id}/bids`); setBids(data); } catch { setBids([]); }
  };
  const assign = async (bidId) => {
    try { await api.post(`/admin/slots/${bidsFor.id}/assign/${bidId}`); toast.success("Tentor ditugaskan ke jadwal"); setBidsFor(null); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="manage-schedule">
      <PageHeader title="Jadwal & Job Bidding" subtitle="Buka slot mengajar terbuka, tinjau bidding tentor, dan konfirmasi penugasan."
        actions={<Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-slot-btn"><Plus className="h-4 w-4" /> Buka Slot</Button>} />

      {loading ? <Loading /> : !slots?.length ? (
        <Empty icon={CalendarClock} title="Belum ada slot jadwal" />
      ) : (
        <div className="space-y-4">
          {slots.map((s) => {
            const st = STATUS[s.status] || STATUS.open;
            return (
              <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`slot-${s.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex flex-col items-center justify-center shrink-0">
                      <span className="text-base font-bold leading-none">{new Date(s.date).getDate()}</span>
                      <span className="text-[9px] uppercase">{new Date(s.date).toLocaleDateString("id-ID", { month: "short" })}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0A1128]">{s.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                        <span>{s.subject}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time}-{s.end_time}</span>
                        {s.required_qualifications?.length > 0 && <span>Syarat: {s.required_qualifications.join(", ")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }}>{st.l}</span>
                    {s.status === "open" && (
                      <Button variant="outline" size="sm" onClick={() => viewBids(s)} className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid={`view-bids-${s.id}`}>
                        <Gavel className="h-4 w-4" /> Bidding ({s.bid_count})
                      </Button>
                    )}
                    <ConfirmButton onConfirm={() => del(s.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-slot-${s.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create slot dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Buka Slot Mengajar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul Kelas</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="slot-title" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mata Pelajaran</Label><Input value={form.subject} onChange={set("subject")} className="mt-1.5" data-testid="slot-subject" /></div>
              <div><Label>Tanggal</Label><div className="mt-1.5"><DatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} testid="slot-date" /></div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Jam Mulai</Label><Input placeholder="16:00" value={form.start_time} onChange={set("start_time")} className="mt-1.5" data-testid="slot-start" /></div>
              <div><Label>Jam Selesai</Label><Input placeholder="18:00" value={form.end_time} onChange={set("end_time")} className="mt-1.5" data-testid="slot-end" /></div>
            </div>
            <div><Label>Kualifikasi (pisahkan dengan koma)</Label><Input placeholder="Matematika, Fisika" value={form.required_qualifications} onChange={set("required_qualifications")} className="mt-1.5" data-testid="slot-quals" /></div>
            <div><Label>Kaitkan Kursus</Label>
              <Select value={form.course_id} onValueChange={set("course_id")}>
                <SelectTrigger className="mt-1.5" data-testid="slot-course"><SelectValue placeholder="Pilih kursus (opsional)" /></SelectTrigger>
                <SelectContent>{(courses || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Catatan</Label><Textarea value={form.notes} onChange={set("notes")} className="mt-1.5" data-testid="slot-notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-slot">Buka Slot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bids dialog */}
      <Dialog open={!!bidsFor} onOpenChange={() => setBidsFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bidding — {bidsFor?.title}</DialogTitle></DialogHeader>
          {bids.length === 0 ? <p className="text-sm text-[#94A3B8] py-6 text-center">Belum ada tentor yang mengajukan.</p> : (
            <div className="space-y-3">
              {bids.map((b) => (
                <div key={b.id} className="rounded-xl border border-[#E2E8F0] p-4" data-testid={`bid-${b.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-[#4361EE]" /><span className="font-semibold text-[#0A1128] text-sm">{b.tutor_name}</span></div>
                    <Button size="sm" onClick={() => assign(b.id)} className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid={`assign-${b.id}`}><CheckCircle2 className="h-4 w-4" /> Tugaskan</Button>
                  </div>
                  {b.message && <p className="mt-2 text-sm text-[#475569]">{b.message}</p>}
                  <p className="mt-1 text-xs text-[#94A3B8]">{formatDate(b.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
