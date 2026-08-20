import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, HelpCircle, CheckCircle2, X, Upload, FileDown, Tag } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const TYPES = [
  { v: "single", l: "Pilihan Ganda" },
  { v: "multiple", l: "Pilihan Ganda Kompleks" },
  { v: "truefalse", l: "Benar / Salah" },
  { v: "essay", l: "Esai (jawaban teks)" },
];
const COMPETENCIES = [
  { v: "numerasi", l: "Numerasi" },
  { v: "literasi", l: "Literasi" },
  { v: "umum", l: "Umum" },
];
const COMP_LABEL = { numerasi: "Numerasi", literasi: "Literasi", umum: "Umum" };
const COMP_COLOR = { numerasi: "#4361EE", literasi: "#FF9F1C", umum: "#94A3B8" };
const newOpts = () => [{ id: "o1", text: "" }, { id: "o2", text: "" }, { id: "o3", text: "" }, { id: "o4", text: "" }];
const EMPTY = { type: "single", text: "", points: 20, options: newOpts(), correct: [], essay: "", competency: "umum" };

export default function TryoutBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: questions, loading, refetch } = useFetch(`/admin/tryouts/${id}/questions`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const fileRef = useRef();
  const [selected, setSelected] = useState(new Set());
  const [bulkComp, setBulkComp] = useState("numerasi");

  const toggleSelect = (qid) => setSelected((s) => { const n = new Set(s); n.has(qid) ? n.delete(qid) : n.add(qid); return n; });
  const allIds = (questions || []).map((q) => q.id);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const applyBulk = async () => {
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/questions/bulk-competency`, { question_ids: [...selected], competency: bulkComp });
      toast.success(`${data.updated} soal ditandai ${COMP_LABEL[bulkComp]}`);
      setSelected(new Set());
      refetch();
    } catch (e) { toast.error(apiError(e)); }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/admin/questions/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = "template_soal.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh template"); }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/questions/import`, fd);
      toast.success(`${data.imported} soal berhasil diimpor`);
      if (data.errors?.length) toast.error(`${data.errors.length} baris gagal. ${data.errors[0]}`);
      refetch();
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (q) => {
    setForm({
      type: q.type, text: q.text, points: q.points,
      options: q.options?.length ? q.options : newOpts(),
      correct: q.type === "essay" ? [] : q.correct_answers,
      essay: q.type === "essay" ? (q.correct_answers || []).join(", ") : "",
      competency: q.competency || "umum",
    });
    setEditId(q.id); setOpen(true);
  };

  const setOpt = (i, val) => setForm((f) => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, text: val } : o) }));
  const addOpt = () => setForm((f) => ({ ...f, options: [...f.options, { id: `o${f.options.length + 1}`, text: "" }] }));
  const removeOpt = (oid) => setForm((f) => ({ ...f, options: f.options.filter((o) => o.id !== oid), correct: f.correct.filter((c) => c !== oid) }));
  const toggleMulti = (oid) => setForm((f) => ({ ...f, correct: f.correct.includes(oid) ? f.correct.filter((c) => c !== oid) : [...f.correct, oid] }));

  const save = async () => {
    let correct_answers = [];
    let options = [];
    if (form.type === "single" || form.type === "multiple") {
      options = form.options.filter((o) => o.text.trim());
      correct_answers = form.correct.filter((c) => options.some((o) => o.id === c));
      if (options.length < 2) return toast.error("Minimal 2 pilihan jawaban");
      if (correct_answers.length === 0) return toast.error("Tentukan kunci jawaban");
    } else if (form.type === "truefalse") {
      if (!form.correct[0]) return toast.error("Pilih kunci Benar/Salah");
      correct_answers = [form.correct[0]];
    } else {
      correct_answers = form.essay.split(",").map((s) => s.trim()).filter(Boolean);
      if (!correct_answers.length) return toast.error("Isi kunci jawaban esai");
    }
    const payload = { type: form.type, text: form.text, options, correct_answers, points: parseInt(form.points || 1, 10), order: 0, competency: form.competency || "umum" };
    try {
      if (editId) await api.put(`/admin/questions/${editId}`, payload);
      else await api.post(`/admin/tryouts/${id}/questions`, payload);
      toast.success("Soal tersimpan"); setOpen(false); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (qid) => { try { await api.delete(`/admin/questions/${qid}`); toast.success("Soal dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  const typeLabel = (t) => TYPES.find((x) => x.v === t)?.l || t;

  return (
    <div data-testid="tryout-builder">
      <Button variant="ghost" onClick={() => navigate("/admin/tryouts")} className="mb-3 text-[#475569] hover:text-[#4361EE] hover:bg-[#EEF2FF]"><ArrowLeft className="h-4 w-4" /> Kembali</Button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1128]">Kelola Bank Soal</h1>
          <p className="text-sm text-[#475569] mt-1">{questions?.length || 0} soal · Total {(questions || []).reduce((a, q) => a + (q.points || 0), 0)} poin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate} className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="download-template"><FileDown className="h-4 w-4" /> Template</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="import-questions"><Upload className="h-4 w-4" /> Impor CSV/Excel</Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onImport} data-testid="import-file" />
          <Button onClick={openNew} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-question-btn"><Plus className="h-4 w-4" /> Tambah Soal</Button>
        </div>
      </div>

      {loading ? <Loading /> : !questions?.length ? (
        <Empty icon={HelpCircle} title="Belum ada soal" desc="Tambahkan soal pertama untuk Try Out ini." action={<Button onClick={openNew} className="rounded-full bg-[#4361EE]"><Plus className="h-4 w-4" /> Tambah Soal</Button>} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E2E8F0] p-3" data-testid="bulk-toolbar">
            <label className="flex items-center gap-2 text-sm font-medium text-[#475569] cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} data-testid="select-all-questions" /> Pilih Semua
            </label>
            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="text-sm font-semibold text-[#0A1128]" data-testid="bulk-count">{selected.size} soal dipilih</span>
                <span className="text-xs text-[#94A3B8]">tandai sebagai</span>
                <Select value={bulkComp} onValueChange={setBulkComp}>
                  <SelectTrigger className="h-9 w-36" data-testid="bulk-competency-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPETENCIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={applyBulk} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="apply-bulk-competency"><Tag className="h-4 w-4" /> Terapkan</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="rounded-full">Batal</Button>
              </div>
            ) : (
              <span className="ml-auto text-xs text-[#94A3B8]">Pilih beberapa soal untuk menandai kompetensi (Numerasi/Literasi) sekaligus.</span>
            )}
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className={`bg-white rounded-xl border p-5 transition-colors duration-200 ${selected.has(q.id) ? "border-[#4361EE] ring-1 ring-[#4361EE]/30" : "border-[#E2E8F0]"}`} data-testid={`question-${q.id}`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} className="mt-1 shrink-0" data-testid={`select-question-${q.id}`} />
                <div className="flex-1 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#EEF2FF] text-[#4361EE] px-2.5 py-0.5 text-xs font-bold">#{i + 1}</span>
                    <span className="text-xs text-[#94A3B8]">{typeLabel(q.type)} · {q.points} poin</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${COMP_COLOR[q.competency || "umum"]}1A`, color: COMP_COLOR[q.competency || "umum"] }} data-testid={`question-competency-${q.id}`}>{COMP_LABEL[q.competency || "umum"]}</span>
                  </div>
                  <p className="mt-2 text-[#0A1128]">{q.text}</p>
                  <div className="mt-3 space-y-1">
                    {q.type === "essay" ? (
                      <p className="text-sm text-[#10B981]">Kunci: {q.correct_answers.join(" / ")}</p>
                    ) : q.type === "truefalse" ? (
                      <p className="text-sm text-[#10B981]">Kunci: {q.correct_answers[0] === "true" ? "Benar" : "Salah"}</p>
                    ) : (
                      q.options.map((o) => (
                        <div key={o.id} className={`text-sm flex items-center gap-2 ${q.correct_answers.includes(o.id) ? "text-[#10B981] font-medium" : "text-[#475569]"}`}>
                          {q.correct_answers.includes(o.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#CBD5E1]" />} {o.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)} className="hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid={`edit-question-${q.id}`}><Plus className="h-4 w-4 rotate-45" /></Button>
                  <ConfirmButton onConfirm={() => del(q.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-question-${q.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Soal" : "Tambah Soal"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipe Soal</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, correct: [] }))}>
                  <SelectTrigger className="mt-1.5" data-testid="question-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Poin</Label><Input type="number" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} className="mt-1.5" data-testid="question-points" /></div>
            </div>
            <div><Label>Kompetensi (AKM)</Label>
              <Select value={form.competency} onValueChange={(v) => setForm((f) => ({ ...f, competency: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="question-competency"><SelectValue /></SelectTrigger>
                <SelectContent>{COMPETENCIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 text-xs text-[#94A3B8]">Dipakai untuk laporan kelemahan siswa (Numerasi vs Literasi).</p>
            </div>
            <div><Label>Pertanyaan</Label><Textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} className="mt-1.5" rows={3} data-testid="question-text" /></div>

            {(form.type === "single" || form.type === "multiple") && (
              <div>
                <Label>Pilihan Jawaban <span className="text-[#94A3B8] font-normal">(tandai kunci di kiri)</span></Label>
                <div className="mt-2 space-y-2">
                  {form.options.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2" data-testid={`opt-row-${o.id}`}>
                      {form.type === "single" ? (
                        <button type="button" onClick={() => setForm((f) => ({ ...f, correct: [o.id] }))} data-testid={`mark-correct-${o.id}`}
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${form.correct[0] === o.id ? "border-[#10B981] bg-[#10B981]" : "border-[#CBD5E1]"}`}>
                          {form.correct[0] === o.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>
                      ) : (
                        <button type="button" onClick={() => toggleMulti(o.id)} data-testid={`mark-correct-${o.id}`}
                          className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 ${form.correct.includes(o.id) ? "border-[#10B981] bg-[#10B981]" : "border-[#CBD5E1]"}`}>
                          {form.correct.includes(o.id) && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>
                      )}
                      <Input value={o.text} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Pilihan ${i + 1}`} data-testid={`opt-input-${o.id}`} />
                      {form.options.length > 2 && <Button variant="ghost" size="icon" onClick={() => removeOpt(o.id)}><X className="h-4 w-4 text-[#94A3B8]" /></Button>}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addOpt} className="mt-2 rounded-full" data-testid="add-option"><Plus className="h-4 w-4" /> Tambah Pilihan</Button>
              </div>
            )}

            {form.type === "truefalse" && (
              <div>
                <Label>Kunci Jawaban</Label>
                <RadioGroup value={form.correct[0] || ""} onValueChange={(v) => setForm((f) => ({ ...f, correct: [v] }))} className="mt-2 flex gap-4">
                  {[["true", "Benar"], ["false", "Salah"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer" data-testid={`tf-${v}`}><RadioGroupItem value={v} /> {l}</label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {form.type === "essay" && (
              <div>
                <Label>Kunci Jawaban (pisahkan alternatif dengan koma)</Label>
                <Input value={form.essay} onChange={(e) => setForm((f) => ({ ...f, essay: e.target.value }))} placeholder="jakarta, dki jakarta" className="mt-1.5" data-testid="essay-key" />
                <p className="mt-1 text-xs text-[#94A3B8]">Penilaian mengabaikan huruf besar/kecil & spasi di awal/akhir.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-question">Simpan Soal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
