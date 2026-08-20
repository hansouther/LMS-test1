import { useState } from "react";
import { Plus, Trash2, CalendarClock, Gavel, CheckCircle2, Clock, User, Layers, Wand2 } from "lucide-react";
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

const EMPTY = { title: "", subject: "", required_qualifications: "", course_id: "", open_to_all: false, notes: "", sessions: [] };
const EMPTY_SESSION = { date: "", start_time: "16:00", end_time: "18:00", topic: "" };
const STATUS = { open: { l: "Terbuka", c: "#C9A227", bg: "#FBF3DC" }, confirmed: { l: "Terkonfirmasi", c: "#10B981", bg: "#ECFDF5" } };

export default function ManageSchedule() {
  const { data: slots, loading, refetch } = useFetch("/admin/slots");
  const { data: courses } = useFetch("/admin/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [gen, setGen] = useState({ start: "", count: 8, start_time: "16:00", end_time: "18:00" });
  const [bidsFor, setBidsFor] = useState(null);
  const [bids, setBids] = useState([]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const addSession = () => setForm((f) => ({ ...f, sessions: [...f.sessions, { ...EMPTY_SESSION }] }));
  const updateSession = (i, k, v) => setForm((f) => ({ ...f, sessions: f.sessions.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const removeSession = (i) => setForm((f) => ({ ...f, sessions: f.sessions.filter((_, idx) => idx !== i) }));

  const genWeekly = () => {
    if (!gen.start) return toast.error("Pilih tanggal pertemuan pertama");
    const n = Number(gen.count);
    if (!n || n < 1) return toast.error("Jumlah pertemuan tidak valid");
    const base = new Date(gen.start + "T00:00:00");
    const rows = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i * 7);
      rows.push({ date: d.toISOString().slice(0, 10), start_time: gen.start_time, end_time: gen.end_time, topic: "" });
    }
    setForm((f) => ({ ...f, sessions: rows }));
    toast.success(`${n} pertemuan mingguan dibuat — bisa diedit manual`);
  };

  const save = async () => {
    if (!form.course_id) return toast.error("Kaitkan kelas ke sebuah kursus agar siswa bisa melihatnya");
    if (!form.sessions.length) return toast.error("Tambah minimal satu pertemuan");
    if (form.sessions.some((s) => !s.date || !s.start_time || !s.end_time)) return toast.error("Lengkapi tanggal & jam setiap pertemuan");
    const payload = {
      title: form.title, subject: form.subject, notes: form.notes,
      open_to_all: form.open_to_all, course_id: form.course_id,
      required_qualifications: form.required_qualifications.split(",").map((s) => s.trim()).filter(Boolean),
      sessions: form.sessions,
    };
    try { await api.post("/admin/slots", payload); toast.success("Kelas & jadwal dibuka untuk bidding"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/slots/${id}`); toast.success("Kelas dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  const viewBids = async (slot) => {
    setBidsFor(slot);
    try { const { data } = await api.get(`/admin/slots/${slot.id}/bids`); setBids(data); } catch { setBids([]); }
  };
  const assign = async (bidId) => {
    try { await api.post(`/admin/slots/${bidsFor.id}/assign/${bidId}`); toast.success("Tentor ditugaskan ke kelas"); setBidsFor(null); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const sessionCount = (s) => (s.sessions?.length || (s.date ? 1 : 0));

  return (
    <div data-testid="manage-schedule">
      <PageHeader title="Jadwal Kelas & Job Bidding" subtitle="Buat kelas multi-pertemuan, buka untuk bidding tentor, dan konfirmasi penugasan."
        actions={<Button onClick={() => { setForm(EMPTY); setGen({ start: "", count: 8, start_time: "16:00", end_time: "18:00" }); setOpen(true); }} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-slot-btn"><Plus className="h-4 w-4" /> Buat Kelas</Button>} />

      {loading ? <Loading /> : !slots?.length ? (
        <Empty icon={CalendarClock} title="Belum ada kelas" />
      ) : (
        <div className="space-y-4">
          {slots.map((s) => {
            const st = STATUS[s.status] || STATUS.open;
            const sessions = s.sessions || [];
            return (
              <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`slot-${s.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-[#E6F5F8] text-[#0E7490] flex flex-col items-center justify-center shrink-0">
                      <Layers className="h-4 w-4" /><span className="text-[11px] font-bold leading-none mt-0.5">{sessionCount(s)}x</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0A1128]">{s.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                        <span>{s.subject}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {sessionCount(s)} pertemuan</span>
                        {sessions[0]?.date && <span>Mulai {formatDate(sessions[0].date)}</span>}
                        {s.required_qualifications?.length > 0 && <span>Syarat: {s.required_qualifications.join(", ")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }}>{st.l}</span>
                    {s.status === "open" && (
                      <Button variant="outline" size="sm" onClick={() => viewBids(s)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`view-bids-${s.id}`}>
                        <Gavel className="h-4 w-4" /> Bidding ({s.bid_count})
                      </Button>
                    )}
                    <ConfirmButton onConfirm={() => del(s.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-slot-${s.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                  </div>
                </div>
                {sessions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-2" data-testid={`slot-sessions-${s.id}`}>
                    {sessions.map((se) => (
                      <span key={se.id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6F8] px-2.5 py-1 text-[11px] text-[#475569]">
                        <span className="font-semibold text-[#0E7490]">#{se.no}</span> {formatDate(se.date)} · {se.start_time}-{se.end_time}{se.topic ? ` · ${se.topic}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create class dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Kelas Multi-Pertemuan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul Kelas</Label><Input value={form.title} onChange={set("title")} placeholder="Kelas Intensif Matematika UTBK" className="mt-1.5" data-testid="slot-title" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mata Pelajaran</Label><Input value={form.subject} onChange={set("subject")} className="mt-1.5" data-testid="slot-subject" /></div>
              <div><Label>Kaitkan Kursus (wajib)</Label>
                <Select value={form.course_id} onValueChange={set("course_id")}>
                  <SelectTrigger className="mt-1.5" data-testid="slot-course"><SelectValue placeholder="Pilih kursus" /></SelectTrigger>
                  <SelectContent>{(courses || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Kualifikasi Tentor (pisahkan dengan koma)</Label><Input placeholder="Matematika, Fisika" value={form.required_qualifications} onChange={set("required_qualifications")} className="mt-1.5" data-testid="slot-quals" /></div>

            {/* Weekly generator */}
            <div className="rounded-xl bg-[#EFF6F8] p-4">
              <p className="text-sm font-semibold text-[#0A1128] flex items-center gap-2 mb-3"><Wand2 className="h-4 w-4 text-[#0E7490]" /> Buat Pertemuan Mingguan Otomatis</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div><Label className="text-xs">Pertemuan #1</Label><div className="mt-1"><DatePicker value={gen.start} onChange={(v) => setGen((g) => ({ ...g, start: v }))} testid="gen-start-date" /></div></div>
                <div><Label className="text-xs">Jumlah</Label><Input type="number" min="1" value={gen.count} onChange={(e) => setGen((g) => ({ ...g, count: e.target.value }))} className="mt-1 h-10" data-testid="gen-count" /></div>
                <div><Label className="text-xs">Jam Mulai</Label><Input value={gen.start_time} onChange={(e) => setGen((g) => ({ ...g, start_time: e.target.value }))} className="mt-1 h-10" data-testid="gen-start-time" /></div>
                <div><Label className="text-xs">Jam Selesai</Label><Input value={gen.end_time} onChange={(e) => setGen((g) => ({ ...g, end_time: e.target.value }))} className="mt-1 h-10" data-testid="gen-end-time" /></div>
              </div>
              <Button type="button" variant="outline" onClick={genWeekly} className="mt-3 rounded-full hover:bg-white" data-testid="gen-weekly-btn"><Wand2 className="h-4 w-4" /> Generate {gen.count} Pertemuan</Button>
            </div>

            {/* Sessions list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Daftar Pertemuan ({form.sessions.length})</Label>
                <Button type="button" size="sm" variant="outline" onClick={addSession} className="rounded-full" data-testid="add-session-btn"><Plus className="h-3.5 w-3.5" /> Tambah Pertemuan</Button>
              </div>
              {form.sessions.length === 0 ? (
                <p className="text-sm text-[#94A3B8] py-3">Belum ada pertemuan. Gunakan generator otomatis atau tambah manual.</p>
              ) : (
                <div className="space-y-2" data-testid="sessions-editor">
                  {form.sessions.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-[#E2E8F0] p-2" data-testid={`session-row-${i}`}>
                      <span className="col-span-1 text-center text-xs font-bold text-[#0E7490]">#{i + 1}</span>
                      <div className="col-span-3"><DatePicker value={s.date} onChange={(v) => updateSession(i, "date", v)} testid={`session-date-${i}`} /></div>
                      <Input className="col-span-2 h-9" value={s.start_time} onChange={(e) => updateSession(i, "start_time", e.target.value)} placeholder="16:00" data-testid={`session-start-${i}`} />
                      <Input className="col-span-2 h-9" value={s.end_time} onChange={(e) => updateSession(i, "end_time", e.target.value)} placeholder="18:00" data-testid={`session-end-${i}`} />
                      <Input className="col-span-3 h-9" value={s.topic} onChange={(e) => updateSession(i, "topic", e.target.value)} placeholder="Topik" data-testid={`session-topic-${i}`} />
                      <button type="button" onClick={() => removeSession(i)} className="col-span-1 text-[#CBD5E1] hover:text-red-600" data-testid={`remove-session-${i}`}><Trash2 className="h-4 w-4 mx-auto" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3"><Switch checked={form.open_to_all} onCheckedChange={(v) => setForm((f) => ({ ...f, open_to_all: v }))} data-testid="slot-open-all" /><Label>Tampilkan ke semua siswa (bukan hanya yang enrol kursus)</Label></div>
            <div><Label>Catatan (opsional)</Label><Textarea value={form.notes} onChange={set("notes")} className="mt-1.5" data-testid="slot-notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-slot">Buka untuk Bidding</Button>
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
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-[#0E7490]" /><span className="font-semibold text-[#0A1128] text-sm">{b.tutor_name}</span></div>
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
