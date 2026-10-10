import { useState } from "react";
import { Users, ClipboardCheck, Clock, Save, Star, BookOpen, Plus, Trash2, LinkIcon, FileText, Paperclip, Loader2, ChevronRight } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { fileUrl, uploadFile } from "@/lib/media";
import { toast } from "sonner";

const ATT_OPTS = [["present", "Hadir"], ["late", "Terlambat"], ["absent", "Tidak Hadir"]];

export default function ClassManagerView() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data: classes, loading } = useFetch("/classes/mine");
  const [active, setActive] = useState(null);
  const [materialSession, setMaterialSession] = useState(null);
  const [attSession, setAttSession] = useState(null);
  const [recap, setRecap] = useState(null);

  return (
    <div data-testid="class-manager">
      <PageHeader title="Manajemen Kelas" subtitle="Kelola materi & presensi tiap pertemuan pada kelas terkonfirmasi." />

      {loading ? <Loading /> : !classes?.length ? (
        <Empty icon={Users} title="Belum ada kelas" desc="Kelas terkonfirmasi akan muncul di sini." />
      ) : (
        <div className="space-y-4">
          {classes.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden" data-testid={`class-${c.id}`}>
              <div className="w-full p-5 flex items-center justify-between gap-3">
                <button onClick={() => setActive(active === c.id ? null : c.id)} className="flex items-center gap-4 text-left flex-1 min-w-0" data-testid={`class-toggle-${c.id}`}>
                  <div className="h-12 w-12 rounded-xl bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center shrink-0"><Users className="h-6 w-6" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0A1128] truncate">{c.title}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{c.subject} · {c.sessions.length} pertemuan · {c.material_count} materi{c.course_title ? ` · ${c.course_title}` : ""}{!isTutor ? ` · ${c.tutor_name}` : ""}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setRecap(c)} className="rounded-full hover:bg-[#ECFDF5] hover:text-[#10B981]" data-testid={`recap-btn-${c.id}`}><ClipboardCheck className="h-4 w-4" /> Rekap</Button>
                  <button onClick={() => setActive(active === c.id ? null : c.id)}><ChevronRight className={`h-5 w-5 text-[#94A3B8] transition-transform duration-200 ${active === c.id ? "rotate-90" : ""}`} /></button>
                </div>
              </div>

              {active === c.id && (
                <div className="border-t border-[#E2E8F0] divide-y divide-[#F1F5F9]" data-testid={`class-sessions-${c.id}`}>
                  {c.sessions.map((s) => (
                    <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" data-testid={`session-${s.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#EFF6F8] text-[#0E7490] flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase leading-none">Ke</span>
                          <span className="text-sm font-bold leading-none">{s.no}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0A1128]">{s.topic || `Pertemuan ${s.no}`}</p>
                          <p className="text-xs text-[#94A3B8] flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(s.date)} · {s.start_time}-{s.end_time}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setMaterialSession({ cls: c, session: s })} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`materi-btn-${s.id}`}><BookOpen className="h-4 w-4" /> Materi</Button>
                        <Button size="sm" onClick={() => setAttSession({ cls: c, session: s })} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid={`presensi-btn-${s.id}`}><ClipboardCheck className="h-4 w-4" /> Presensi</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {materialSession && <MaterialDialog data={materialSession} onClose={() => setMaterialSession(null)} />}
      {attSession && <AttendanceDialog data={attSession} isTutor={isTutor} onClose={() => setAttSession(null)} />}
      {recap && <RecapDialog cls={recap} onClose={() => setRecap(null)} />}
    </div>
  );
}

function RecapDialog({ cls, onClose }) {
  const { data, loading } = useFetch(`/classes/${cls.id}/attendance-summary`);
  const rateColor = (r) => r >= 80 ? "#10B981" : r >= 50 ? "#C9A227" : "#EF4444";
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="recap-dialog">
        <DialogHeader><DialogTitle>Rekap Kehadiran — {cls.title}</DialogTitle></DialogHeader>
        {loading ? <Loading /> : !data?.rows?.length ? (
          <p className="text-sm text-[#94A3B8] py-6 text-center">Belum ada siswa terdaftar.</p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            <p className="text-xs text-[#94A3B8]">Dari {data.total_sessions} pertemuan</p>
            {data.rows.map((r) => (
              <div key={r.student_id} className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`recap-row-${r.student_id}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-[#0A1128]">{r.name}</p>
                  <span className="text-sm font-bold" style={{ color: rateColor(r.rate) }}>{r.rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.rate}%`, backgroundColor: rateColor(r.rate) }} />
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1.5">Hadir {r.present} · Terlambat {r.late} · Absen {r.absent} · Total {r.total_sessions}</p>
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({ data, onClose }) {
  const { cls, session } = data;
  const { data: materials, loading, refetch } = useFetch(`/classes/${cls.id}/materials`);
  const [form, setForm] = useState({ title: "", description: "", link: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const sessionMaterials = (materials || []).filter((m) => m.session_id === session.id);

  const add = async () => {
    if (!form.title.trim()) return toast.error("Judul materi wajib diisi");
    setSaving(true);
    try {
      let file_url = null, file_name = null;
      if (file) { const up = await uploadFile(file); file_url = up.url; file_name = up.filename; }
      await api.post(`/classes/${cls.id}/sessions/${session.id}/materials`, { ...form, file_url, file_name });
      toast.success("Materi ditambahkan");
      setForm({ title: "", description: "", link: "" }); setFile(null); refetch();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (id) => { try { await api.delete(`/classes/materials/${id}`); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="material-dialog">
        <DialogHeader><DialogTitle>Materi — Pertemuan {session.no}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[40vh] overflow-y-auto">
          {loading ? <Loading /> : sessionMaterials.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-4">Belum ada materi untuk pertemuan ini.</p>
          ) : sessionMaterials.map((m) => (
            <div key={m.id} className="rounded-lg border border-[#E2E8F0] p-3 flex items-start justify-between gap-3" data-testid={`material-${m.id}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0A1128]">{m.title}</p>
                {m.description && <p className="text-xs text-[#475569] mt-0.5">{m.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                  {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0E7490] hover:underline"><LinkIcon className="h-3 w-3" /> Tautan</a>}
                  {m.file_url && <a href={fileUrl(m.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#10B981] hover:underline"><FileText className="h-3 w-3" /> {m.file_name || "Berkas"}</a>}
                </div>
              </div>
              <ConfirmButton onConfirm={() => del(m.id)} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 shrink-0" data-testid={`del-material-${m.id}`}><Trash2 className="h-4 w-4" /></Button>} />
            </div>
          ))}
        </div>
        <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
          <p className="text-sm font-semibold text-[#0A1128]">Tambah Materi</p>
          <Input placeholder="Judul materi" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} data-testid="material-title" />
          <Textarea placeholder="Deskripsi singkat (opsional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} data-testid="material-desc" />
          <Input placeholder="Tautan (YouTube/Google Drive/URL)" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} data-testid="material-link" />
          <label className="flex items-center gap-2 text-sm text-[#475569] cursor-pointer rounded-lg border border-dashed border-[#CBD5E1] p-3 hover:bg-[#EFF6F8]" data-testid="material-file-label">
            <Paperclip className="h-4 w-4 text-[#0E7490]" /> {file ? file.name : "Unggah berkas (PDF/dokumen) — opsional"}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          <Button onClick={add} disabled={saving} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-material">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Tambah</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceDialog({ data, isTutor, onClose }) {
  const { cls, session } = data;
  const { data: roster, loading } = useFetch(`/classes/${cls.id}/sessions/${session.id}/roster`);
  const [records, setRecords] = useState({});
  const [favs, setFavs] = useState({});
  const [saving, setSaving] = useState(false);
  const students = roster?.students || [];

  const ensureInit = () => {
    if (students.length && Object.keys(records).length === 0) {
      const r = {}, f = {};
      students.forEach((s) => { r[s.id] = s.attendance_status || "present"; f[s.id] = { is: !!s.is_favorite, note: s.favorite_note || "" }; });
      setRecords(r); setFavs(f);
    }
  };
  ensureInit();

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/classes/${cls.id}/sessions/${session.id}/attendance`, {
        records: Object.entries(records).map(([student_id, status]) => ({ student_id, status })),
      });
      toast.success("Presensi tersimpan"); onClose();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const toggleFav = async (sid) => {
    if (!cls.course_id) return toast.error("Kelas ini belum terkait kursus");
    const cur = favs[sid] || { is: false, note: "" };
    try {
      if (cur.is) { await api.delete("/tutor/favorites", { params: { student_id: sid, course_id: cls.course_id } }); setFavs((f) => ({ ...f, [sid]: { ...cur, is: false } })); }
      else { await api.post("/tutor/favorites", { student_id: sid, course_id: cls.course_id, note: cur.note }); setFavs((f) => ({ ...f, [sid]: { ...cur, is: true } })); toast.success("Ditandai siswa unggulan"); }
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="attendance-dialog">
        <DialogHeader><DialogTitle>Presensi — Pertemuan {session.no}</DialogTitle></DialogHeader>
        {loading ? <Loading /> : students.length === 0 ? (
          <p className="text-sm text-[#94A3B8] py-6 text-center">Belum ada siswa terdaftar di kursus kelas ini.</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {students.map((s) => (
              <div key={s.id} className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`att-row-${s.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isTutor && cls.course_id && (
                      <button onClick={() => toggleFav(s.id)} data-testid={`fav-btn-${s.id}`} title="Tandai siswa unggulan" className={favs[s.id]?.is ? "text-[#C9A227]" : "text-[#CBD5E1] hover:text-[#C9A227]"}>
                        <Star className="h-5 w-5" fill={favs[s.id]?.is ? "#C9A227" : "none"} />
                      </button>
                    )}
                    <div><p className="text-sm font-medium text-[#0A1128]">{s.name}</p><p className="text-xs text-[#94A3B8]">{s.email}</p></div>
                  </div>
                  <Select value={records[s.id] || "present"} onValueChange={(v) => setRecords((r) => ({ ...r, [s.id]: v }))}>
                    <SelectTrigger className="w-32 h-9" data-testid={`att-select-${s.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ATT_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
        {students.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            <Button onClick={save} disabled={saving} className="bg-[#10B981] hover:bg-[#0ea371]" data-testid="save-attendance"><Save className="h-4 w-4" /> Simpan Presensi</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
