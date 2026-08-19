import { useState } from "react";
import { Users, ClipboardCheck, Clock, Save, Star } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTS = [["present", "Hadir"], ["late", "Terlambat"], ["absent", "Tidak Hadir"]];

export default function ClassManagement() {
  const { data: classes, loading } = useFetch("/tutor/calendar");
  const [active, setActive] = useState(null);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [favs, setFavs] = useState({});
  const [saving, setSaving] = useState(false);

  const openClass = async (slot) => {
    setActive(slot);
    try {
      const { data } = await api.get(`/tutor/classes/${slot.id}/students`);
      setStudents(data.students);
      const init = {}, fav = {};
      data.students.forEach((s) => {
        init[s.id] = s.attendance_status || "present";
        fav[s.id] = { is: !!s.is_favorite, note: s.favorite_note || "" };
      });
      setRecords(init);
      setFavs(fav);
    } catch (e) { toast.error(apiError(e)); setStudents([]); }
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const payload = { slot_id: active.id, records: Object.entries(records).map(([student_id, status]) => ({ student_id, status })) };
      await api.post("/tutor/attendance", payload);
      toast.success("Presensi tersimpan");
      setActive(null);
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const toggleFav = async (sid) => {
    if (!active?.course_id) return toast.error("Kelas ini belum terkait kursus");
    const cur = favs[sid] || { is: false, note: "" };
    try {
      if (cur.is) {
        await api.delete("/tutor/favorites", { params: { student_id: sid, course_id: active.course_id } });
        setFavs((f) => ({ ...f, [sid]: { ...cur, is: false } }));
      } else {
        await api.post("/tutor/favorites", { student_id: sid, course_id: active.course_id, note: cur.note });
        setFavs((f) => ({ ...f, [sid]: { ...cur, is: true } }));
        toast.success("Ditandai sebagai siswa unggulan (peluang tinggi berhasil)");
      }
    } catch (e) { toast.error(apiError(e)); }
  };

  const saveNote = async (sid) => {
    const cur = favs[sid];
    if (!cur?.is || !active?.course_id) return;
    try { await api.post("/tutor/favorites", { student_id: sid, course_id: active.course_id, note: cur.note }); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="class-management">
      <PageHeader title="Manajemen Kelas" subtitle="Catat presensi siswa untuk setiap kelas terkonfirmasi." />

      {loading ? <Loading /> : !classes?.length ? (
        <Empty icon={Users} title="Belum ada kelas" desc="Kelas terkonfirmasi akan muncul di sini." />
      ) : (
        <div className="space-y-4">
          {classes.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex items-center justify-between" data-testid={`class-${c.id}`}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center shrink-0"><Users className="h-6 w-6" /></div>
                <div>
                  <p className="font-semibold text-[#0A1128]">{c.title}</p>
                  <p className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5"><Clock className="h-3.5 w-3.5" /> {c.start_time}-{c.end_time} · {formatDate(c.date)}</p>
                </div>
              </div>
              <Button onClick={() => openClass(c)} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid={`attendance-btn-${c.id}`}><ClipboardCheck className="h-4 w-4" /> Presensi</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={() => setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Presensi — {active?.title}</DialogTitle></DialogHeader>
          {students.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-6 text-center">Belum ada siswa terdaftar di kursus kelas ini.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {students.map((s) => (
                <div key={s.id} className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`att-row-${s.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {active?.course_id && (
                        <button onClick={() => toggleFav(s.id)} data-testid={`fav-btn-${s.id}`} title="Tandai siswa unggulan"
                          className={favs[s.id]?.is ? "text-[#FF9F1C]" : "text-[#CBD5E1] hover:text-[#FF9F1C]"}>
                          <Star className="h-5 w-5" fill={favs[s.id]?.is ? "#FF9F1C" : "none"} />
                        </button>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#0A1128]">{s.name}</p>
                        <p className="text-xs text-[#94A3B8]">{s.email}</p>
                      </div>
                    </div>
                    <Select value={records[s.id]} onValueChange={(v) => setRecords((r) => ({ ...r, [s.id]: v }))}>
                      <SelectTrigger className="w-32 h-9" data-testid={`att-select-${s.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {active?.course_id && favs[s.id]?.is && (
                    <Input value={favs[s.id]?.note || ""} onChange={(e) => setFavs((f) => ({ ...f, [s.id]: { ...f[s.id], note: e.target.value } }))}
                      onBlur={() => saveNote(s.id)} placeholder="Catatan peluang keberhasilan (mis. konsisten & rajin)"
                      className="mt-2 h-9 text-sm" data-testid={`fav-note-${s.id}`} />
                  )}
                </div>
              ))}
            </div>
          )}
          {students.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setActive(null)}>Tutup</Button>
              <Button onClick={saveAttendance} disabled={saving} className="bg-[#10B981] hover:bg-[#0ea371]" data-testid="save-attendance"><Save className="h-4 w-4" /> Simpan Presensi</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
