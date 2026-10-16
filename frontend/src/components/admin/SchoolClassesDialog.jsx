import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Download, Pencil, Check, X, Users, AlertTriangle } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVELS } from "@/components/common/ClassPicker";
import { toast } from "sonner";
import ConfirmButton from "@/components/common/ConfirmButton";

function GenerateForm({ schoolId, onDone }) {
  const [f, setF] = useState({ level: "SMA", prefix: "XII", from: 1, to: 10, manual: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const from = Number(f.from), to = Number(f.to);
  const generated = f.prefix.trim() && from >= 1 && to >= from && to - from < 50
    ? Array.from({ length: to - from + 1 }, (_, i) => `${f.prefix.trim()}-${from + i}`) : [];
  const manual = f.manual.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const labels = manual.length ? manual : generated;

  const submit = async () => {
    if (!labels.length) return toast.error("Isi nama kelas terlebih dahulu");
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/schools/${schoolId}/classes`, { level: f.level, labels });
      toast.success(`${data.created} kelas ditambahkan${data.skipped ? `, ${data.skipped} dilewati (sudah ada)` : ""}`);
      setF((s) => ({ ...s, manual: "" }));
      onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3" data-testid="class-generate-form">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <Label className="text-xs">Jenjang</Label>
          <Select value={f.level} onValueChange={set("level")}>
            <SelectTrigger className="mt-1 h-10" data-testid="gen-level"><SelectValue /></SelectTrigger>
            <SelectContent>{LEVELS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Awalan</Label><Input value={f.prefix} onChange={set("prefix")} placeholder="XII" className="mt-1 h-10" data-testid="gen-prefix" /></div>
        <div><Label className="text-xs">Dari</Label><Input type="number" min={1} value={f.from} onChange={set("from")} className="mt-1 h-10" data-testid="gen-from" /></div>
        <div><Label className="text-xs">Sampai</Label><Input type="number" min={1} value={f.to} onChange={set("to")} className="mt-1 h-10" data-testid="gen-to" /></div>
      </div>
      <div>
        <Label className="text-xs">Atau tulis manual (pisahkan dengan koma)</Label>
        <Input value={f.manual} onChange={set("manual")} placeholder="XII IPA 1, XII IPS 2" className="mt-1 h-10" data-testid="gen-manual" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#475569] min-w-0 break-words" data-testid="gen-preview">Akan dibuat: {labels.length ? labels.slice(0, 6).join(", ") + (labels.length > 6 ? ` … (${labels.length} kelas)` : "") : "-"}</p>
        <Button size="sm" onClick={submit} disabled={busy} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="gen-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Tambah Kelas</>}
        </Button>
      </div>
    </div>
  );
}

function ClassRow({ c, onChanged }) {
  const [edit, setEdit] = useState(null);
  const save = async () => {
    try { await api.put(`/admin/school-classes/${c.id}`, edit); toast.success("Kelas diperbarui"); setEdit(null); onChanged(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const remove = async () => {
    try { await api.delete(`/admin/school-classes/${c.id}`); toast.success("Kelas dihapus"); onChanged(); } catch (e) { toast.error(apiError(e)); }
  };
  const download = async () => {
    try {
      const res = await api.get(`/admin/school-classes/${c.id}/scores.csv`, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(res.data); a.download = `nilai_kelas_${c.label}.csv`; a.click();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (edit) return (
    <div className="flex flex-wrap items-center gap-2 py-2" data-testid={`class-row-${c.label}`}>
      <Input value={edit.label} onChange={(e) => setEdit((s) => ({ ...s, label: e.target.value }))} className="h-9 w-32" data-testid="class-edit-label" />
      <Select value={edit.level} onValueChange={(v) => setEdit((s) => ({ ...s, level: v }))}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{LEVELS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={save} data-testid="class-edit-save"><Check className="h-4 w-4 text-emerald-600" /></Button>
      <Button size="icon" variant="ghost" onClick={() => setEdit(null)}><X className="h-4 w-4" /></Button>
    </div>
  );
  return (
    <div className="flex items-center gap-2 py-2" data-testid={`class-row-${c.label}`}>
      <span className="font-semibold text-sm text-[#0A1128] min-w-0 truncate">{c.label}</span>
      <span className="text-xs text-[#94A3B8] flex items-center gap-1 shrink-0"><Users className="h-3 w-3" />{c.student_count}</span>
      <div className="ml-auto flex shrink-0">
        <Button size="icon" variant="ghost" title="Unduh nilai kelas (rapor)" onClick={download} data-testid={`class-download-${c.label}`}><Download className="h-4 w-4 text-[#0E7490]" /></Button>
        <Button size="icon" variant="ghost" title="Ubah" onClick={() => setEdit({ label: c.label, level: c.level })} data-testid={`class-edit-${c.label}`}><Pencil className="h-4 w-4" /></Button>
        <ConfirmButton title={`Hapus kelas ${c.label}?`} description={`${c.student_count} siswa di kelas ini akan diminta memilih kelas ulang.`} onConfirm={remove}
          trigger={<Button size="icon" variant="ghost" title="Hapus" data-testid={`class-delete-${c.label}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>} />
      </div>
    </div>
  );
}

export default function SchoolClassesDialog({ school, onOpenChange }) {
  const [data, setData] = useState(null);
  const load = () => school && api.get(`/admin/schools/${school.id}/classes`).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { setData(null); load(); }, [school?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={!!school} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="school-classes-dialog">
        <DialogHeader>
          <DialogTitle>Daftar Kelas — {school?.name}</DialogTitle>
          <DialogDescription>Siswa hanya bisa memilih kelas dari daftar ini, sehingga nilai Try Out tercatat rapi per kelas.</DialogDescription>
        </DialogHeader>
        {school && <GenerateForm schoolId={school.id} onDone={load} />}
        {!data ? <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8] mx-auto my-6" /> : (
          <div className="space-y-4">
            {data.mismatch > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900" data-testid="class-mismatch">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {data.mismatch} siswa belum memilih kelas resmi. Mereka otomatis diarahkan ke halaman Profil untuk memilih ulang saat membuka LMS.
              </p>
            )}
            {data.items.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Belum ada kelas. Siswa sekolah ini masih menulis kelas secara bebas.</p>}
            {LEVELS.map((l) => {
              const rows = data.items.filter((c) => c.level === l.id);
              if (!rows.length) return null;
              return (
                <div key={l.id} data-testid={`class-group-${l.id}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#0E7490] mb-1">{l.label} · {rows.length} kelas</p>
                  <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] px-3">
                    {rows.map((c) => <ClassRow key={c.id} c={c} onChanged={load} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
