import { useEffect, useState, useRef } from "react";
import { UserCog, Save, KeyRound, Loader2, GraduationCap, FileText, Upload, X, Plus, Award } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { fileUrl } from "@/lib/media";
import { useAuth, roleLabel } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", grade: "", goal: "", school_id: "", school_name_text: "" });
  const [schools, setSchools] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [quals, setQuals] = useState([]);
  const [qualInput, setQualInput] = useState("");
  const [savingQuals, setSavingQuals] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvRef = useRef();
  const [certs, setCerts] = useState([]);
  const [uploadingCert, setUploadingCert] = useState(false);
  const certRef = useRef();

  useEffect(() => {
    if (user) setForm({
      name: user.name || "", phone: user.phone || "", grade: user.grade || "",
      goal: user.goal || "", school_id: user.school_id || "", school_name_text: user.school_name_text || "",
    });
    if (user?.role === "tutor") { setQuals(user.qualifications || []); setCerts(user.certificates || []); }
    if (user?.role === "student") api.get("/public/schools").then((r) => setSchools(r.data)).catch(() => {});
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone };
      if (user.role === "student") { payload.grade = form.grade; payload.goal = form.goal; payload.school_id = form.school_id || null; }
      if (user.role === "proctor") payload.school_name_text = form.school_name_text;
      const { data } = await api.put("/auth/profile", payload);
      setUser(data);
      toast.success("Profil berhasil diperbarui");
    } catch (err) { toast.error(apiError(err)); } finally { setSaving(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) return toast.error("Konfirmasi kata sandi tidak cocok");
    if (pwd.new_password.length < 6) return toast.error("Kata sandi baru minimal 6 karakter");
    setPwdSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: pwd.current_password || null, new_password: pwd.new_password });
      toast.success("Kata sandi berhasil diubah");
      setPwd({ current_password: "", new_password: "", confirm: "" });
    } catch (err) { toast.error(apiError(err)); } finally { setPwdSaving(false); }
  };

  const addQual = () => {
    const v = qualInput.trim();
    if (!v) return;
    if (quals.some((q) => q.toLowerCase() === v.toLowerCase())) { setQualInput(""); return; }
    setQuals([...quals, v]); setQualInput("");
  };
  const removeQual = (q) => setQuals(quals.filter((x) => x !== q));
  const onQualKey = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addQual(); }
  };
  const saveQuals = async () => {
    setSavingQuals(true);
    try {
      const { data } = await api.put("/auth/profile", { qualifications: quals });
      setUser(data); setQuals(data.qualifications || []);
      toast.success("Kualifikasi berhasil disimpan");
    } catch (err) { toast.error(apiError(err)); } finally { setSavingQuals(false); }
  };
  const onCvChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("CV harus berformat PDF"); e.target.value = ""; return; }
    setUploadingCv(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/auth/upload-doc", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const { data: updated } = await api.put("/auth/profile", { cv_url: data.url, cv_name: data.name });
      setUser(updated);
      toast.success("CV berhasil diperbarui");
    } catch (err) { toast.error(apiError(err)); } finally { setUploadingCv(false); e.target.value = ""; }
  };
  const onCertChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) { toast.error("Sertifikat harus PDF, PNG, atau JPEG"); e.target.value = ""; return; }
    if (["png", "jpg", "jpeg"].includes(ext) && file.size > 2 * 1024 * 1024) { toast.error("Ukuran gambar sertifikat maksimal 2 MB"); e.target.value = ""; return; }
    setUploadingCert(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/auth/upload-doc", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const next = [...certs, { name: data.name, url: data.url }];
      const { data: updated } = await api.put("/auth/profile", { certificates: next });
      setUser(updated); setCerts(updated.certificates || next);
      toast.success("Sertifikat ditambahkan");
    } catch (err) { toast.error(apiError(err)); } finally { setUploadingCert(false); e.target.value = ""; }
  };
  const removeCert = async (idx) => {
    const next = certs.filter((_, i) => i !== idx);
    try {
      const { data: updated } = await api.put("/auth/profile", { certificates: next });
      setUser(updated); setCerts(updated.certificates || next);
      toast.success("Sertifikat dihapus");
    } catch (err) { toast.error(apiError(err)); }
  };

  if (!user) return null;
  const hasPassword = user.auth_provider !== "google";

  return (
    <div data-testid="profile-page">
      <PageHeader title="Profil Saya" subtitle="Perbarui data diri Anda jika ada yang keliru saat mendaftar." />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile form */}
        <form onSubmit={saveProfile} className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6" data-testid="profile-form">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center"><UserCog className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold text-[#0A1128]">Data Diri</h3>
              <p className="text-xs text-[#94A3B8]">Peran: {roleLabel(user.role)} · {user.email}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div><Label>Nama Lengkap</Label><Input value={form.name} onChange={set("name")} className="mt-1.5 h-11" data-testid="profile-name" /></div>
            <div><Label>No. WhatsApp</Label><Input value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="profile-phone" /></div>

            {user.role === "student" && (
              <>
                <div><Label>Kelas</Label><Input value={form.grade} onChange={set("grade")} placeholder="Kelas 12 IPA" className="mt-1.5 h-11" data-testid="profile-grade" /></div>
                <div>
                  <Label>Asal Sekolah</Label>
                  <Select value={form.school_id} onValueChange={set("school_id")}>
                    <SelectTrigger className="mt-1.5 h-11" data-testid="profile-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                    <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Target Bergabung</Label><Textarea value={form.goal} onChange={set("goal")} className="mt-1.5" data-testid="profile-goal" /></div>
              </>
            )}

            {user.role === "proctor" && (
              <>
                <div><Label>Nama Sekolah</Label><Input value={form.school_name_text} onChange={set("school_name_text")} className="mt-1.5 h-11" data-testid="profile-school-name" /></div>
                <p className="text-[11px] text-[#94A3B8]">Sekolah resmi yang ditautkan untuk pemantauan diatur oleh admin.</p>
              </>
            )}
          </div>
          <div className="mt-6">
            <Button type="submit" disabled={saving} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="profile-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
            </Button>
          </div>
        </form>

        {/* Password */}
        <form onSubmit={savePassword} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 h-fit" data-testid="password-form">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-xl bg-[#FFF4E5] text-[#FF9F1C] flex items-center justify-center"><KeyRound className="h-5 w-5" /></div>
            <h3 className="font-semibold text-[#0A1128]">{hasPassword ? "Ubah Kata Sandi" : "Buat Kata Sandi"}</h3>
          </div>
          <div className="space-y-4">
            {hasPassword && (
              <div><Label>Kata Sandi Saat Ini</Label><Input type="password" value={pwd.current_password} onChange={(e) => setPwd((p) => ({ ...p, current_password: e.target.value }))} className="mt-1.5 h-11" data-testid="pwd-current" /></div>
            )}
            <div><Label>Kata Sandi Baru</Label><Input type="password" value={pwd.new_password} onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="pwd-new" /></div>
            <div><Label>Konfirmasi Kata Sandi</Label><Input type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} className="mt-1.5 h-11" data-testid="pwd-confirm" /></div>
          </div>
          <div className="mt-6">
            <Button type="submit" disabled={pwdSaving} variant="outline" className="rounded-full border-[#CBD5E1] hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="pwd-save">
              {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kata Sandi"}
            </Button>
          </div>
        </form>
      </div>

      {user.role === "tutor" && (
        <div className="mt-6 space-y-6" data-testid="tutor-profile-section">
          {/* Qualifications editor */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6" data-testid="qualifications-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center"><GraduationCap className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-[#0A1128]">Keahlian & Kualifikasi</h3>
                <p className="text-xs text-[#94A3B8]">Ketik bidang keahlian Anda untuk mengikuti Job Bidding.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={qualInput}
                onChange={(e) => setQualInput(e.target.value)}
                onKeyDown={onQualKey}
                placeholder="mis. Matematika, Fisika, Bahasa Inggris"
                className="h-11"
                data-testid="qual-input"
              />
              <Button type="button" onClick={addQual} variant="outline" className="rounded-full shrink-0 hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="qual-add"><Plus className="h-4 w-4" /> Tambah</Button>
            </div>
            <p className="mt-2 text-[11px] text-[#94A3B8]">Tekan Enter atau koma untuk menambah. Huruf besar/kecil tidak berpengaruh saat pencocokan bidding.</p>
            <div className="mt-4 flex flex-wrap gap-2 min-h-[2.5rem]" data-testid="qual-chips">
              {quals.length ? quals.map((q) => (
                <span key={q} className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] text-[#4361EE] px-3 py-1.5 text-xs font-semibold" data-testid={`qual-chip-${q}`}>
                  {q}
                  <button type="button" onClick={() => removeQual(q)} className="hover:text-[#EF4444]" data-testid={`qual-remove-${q}`}><X className="h-3.5 w-3.5" /></button>
                </span>
              )) : <p className="text-sm text-[#94A3B8]">Belum ada kualifikasi. Tambahkan minimal satu keahlian.</p>}
            </div>
            <div className="mt-5">
              <Button type="button" onClick={saveQuals} disabled={savingQuals} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="qual-save">
                {savingQuals ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Simpan Kualifikasi</>}
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
          {/* CV update */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 h-fit" data-testid="cv-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"><FileText className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-[#0A1128]">CV / Curriculum Vitae</h3>
                <p className="text-xs text-[#94A3B8]">Perbarui CV Anda (format PDF).</p>
              </div>
            </div>
            {user.cv_url ? (
              <a href={fileUrl(user.cv_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#4361EE] hover:bg-[#EEF2FF]" data-testid="cv-current">
                <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{user.cv_name || "CV Saya"}</span>
              </a>
            ) : (
              <p className="text-sm text-[#94A3B8]" data-testid="cv-empty">Belum ada CV terunggah.</p>
            )}
            <input ref={cvRef} type="file" accept="application/pdf" className="hidden" onChange={onCvChange} data-testid="cv-file-input" />
            <div className="mt-4">
              <Button type="button" onClick={() => cvRef.current?.click()} disabled={uploadingCv} variant="outline" className="rounded-full border-[#CBD5E1] hover:bg-[#ECFDF5] hover:text-[#10B981]" data-testid="cv-upload-btn">
                {uploadingCv ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {user.cv_url ? "Ganti CV" : "Unggah CV"}</>}
              </Button>
            </div>
          </div>

          {/* Certificates management */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 h-fit" data-testid="certificates-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-[#FFF4E5] text-[#FF9F1C] flex items-center justify-center"><Award className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-[#0A1128]">Sertifikat</h3>
                <p className="text-xs text-[#94A3B8]">Tambah/hapus sertifikat (PDF atau gambar, maks 2 MB).</p>
              </div>
            </div>
            <div className="space-y-2" data-testid="certificates-list">
              {certs.length ? certs.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2" data-testid={`cert-item-${i}`}>
                  <a href={fileUrl(c.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#4361EE] hover:underline min-w-0"><Award className="h-4 w-4 text-[#FF9F1C] shrink-0" /><span className="truncate">{c.name || `Sertifikat ${i + 1}`}</span></a>
                  <button type="button" onClick={() => removeCert(i)} className="text-[#94A3B8] hover:text-[#EF4444] shrink-0" data-testid={`cert-remove-${i}`}><X className="h-4 w-4" /></button>
                </div>
              )) : <p className="text-sm text-[#94A3B8]" data-testid="certificates-empty">Belum ada sertifikat.</p>}
            </div>
            <input ref={certRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={onCertChange} data-testid="cert-file-input" />
            <div className="mt-4">
              <Button type="button" onClick={() => certRef.current?.click()} disabled={uploadingCert} variant="outline" className="rounded-full border-[#CBD5E1] hover:bg-[#FFF4E5] hover:text-[#FF9F1C]" data-testid="cert-upload-btn">
                {uploadingCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Tambah Sertifikat</>}
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
