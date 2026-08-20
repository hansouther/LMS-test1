import { useEffect, useState } from "react";
import { UserCog, Save, KeyRound, Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
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

  useEffect(() => {
    if (user) setForm({
      name: user.name || "", phone: user.phone || "", grade: user.grade || "",
      goal: user.goal || "", school_id: user.school_id || "", school_name_text: user.school_name_text || "",
    });
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
    </div>
  );
}
