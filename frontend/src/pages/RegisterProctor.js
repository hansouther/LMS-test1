import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function RegisterProctor() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ school_name: "", name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (user && user.role) {
      if (user.status && user.status !== "approved" && user.role !== "admin") navigate("/pending", { replace: true });
      else navigate(roleHome(user.role), { replace: true });
    }
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/proctor", form);
      setUser(data);
      toast.success("Pendaftaran proktor terkirim! Menunggu verifikasi admin.");
      navigate("/pending", { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#EFF6F8]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-[#10B981] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <span className="font-head font-bold text-xl text-[#0A1128]">BINARA LMS</span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] text-[#10B981] px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> Portal Proktor Sekolah</span>
          <h1 className="mt-3 text-2xl font-bold text-[#0A1128]">Daftar sebagai Proktor</h1>
          <p className="mt-2 text-sm text-[#475569]">Daftarkan sekolah Anda untuk memantau siswa. Akun akan aktif setelah diverifikasi admin. Sudah punya akun? <Link to="/login" className="text-[#0E7490] font-semibold hover:underline">Masuk</Link></p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="register-proctor-form">
            <div>
              <Label className="text-[#0A1128]">Nama Sekolah</Label>
              <Input required value={form.school_name} onChange={set("school_name")} placeholder="SMA Nusantara 1" className="mt-1.5 h-11" data-testid="proctor-school-name" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Nama Penanggung Jawab (PIC)</Label>
              <Input required value={form.name} onChange={set("name")} placeholder="Nama lengkap PIC" className="mt-1.5 h-11" data-testid="proctor-name" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Email</Label>
              <Input required type="email" value={form.email} onChange={set("email")} placeholder="proktor@sekolah.id" className="mt-1.5 h-11" data-testid="proctor-email" />
            </div>
            <div>
              <Label className="text-[#0A1128]">No. WhatsApp</Label>
              <Input required value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="proctor-phone" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Kata Sandi</Label>
              <Input required type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="proctor-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="proctor-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Daftar Proktor <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[#475569]">Mendaftar sebagai siswa? <Link to="/register" className="text-[#0E7490] font-semibold hover:underline">Daftar Siswa</Link></p>
        </div>
      </div>
    </div>
  );
}