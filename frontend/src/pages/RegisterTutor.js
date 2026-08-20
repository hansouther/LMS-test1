import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Loader2, BadgeCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function RegisterTutor() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (user && user.role) {
      if (user.role === "tutor" && user.status && user.status !== "approved" && !user.cv_url) {
        navigate("/onboarding/tutor", { replace: true });
      } else if (user.status && user.status !== "approved" && user.role !== "admin") {
        navigate("/pending", { replace: true });
      } else {
        navigate(roleHome(user.role), { replace: true });
      }
    }
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/tutor", form);
      setUser(data);
      toast.success("Akun tentor dibuat! Lengkapi CV & sertifikat Anda.");
      navigate("/onboarding/tutor", { replace: true });
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  };

  const googleRegister = () => {
    localStorage.setItem("intended_role", "tutor");
    const redirectUrl = window.location.origin + "/register/tentor";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F4F7FE]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-[#FF9F1C] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <span className="font-head font-bold text-xl text-[#0A1128]">CendekiaLMS</span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF4E5] text-[#FF9F1C] px-3 py-1 text-xs font-semibold"><BadgeCheck className="h-3.5 w-3.5" /> Portal Tentor / Pengajar</span>
          <h1 className="mt-3 text-2xl font-bold text-[#0A1128]">Daftar sebagai Tentor</h1>
          <p className="mt-2 text-sm text-[#475569]">Bergabung mengajar di CendekiaLMS. Akun aktif setelah CV & sertifikat diverifikasi admin. Sudah punya akun? <Link to="/login" className="text-[#4361EE] font-semibold hover:underline">Masuk</Link></p>

          <Button variant="outline" onClick={googleRegister} className="w-full h-11 rounded-full border-[#CBD5E1] hover:bg-white mt-6" data-testid="tutor-google-btn">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-4 w-4" /> Daftar dengan Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-[#94A3B8]"><div className="flex-1 h-px bg-[#E2E8F0]" /> atau isi manual <div className="flex-1 h-px bg-[#E2E8F0]" /></div>

          <form onSubmit={submit} className="space-y-4" data-testid="register-tutor-form">
            <div><Label className="text-[#0A1128]">Nama Lengkap</Label><Input required value={form.name} onChange={set("name")} placeholder="Nama lengkap Anda" className="mt-1.5 h-11" data-testid="tutor-name" /></div>
            <div><Label className="text-[#0A1128]">Email</Label><Input required type="email" value={form.email} onChange={set("email")} placeholder="tentor@email.com" className="mt-1.5 h-11" data-testid="tutor-email" /></div>
            <div><Label className="text-[#0A1128]">No. WhatsApp</Label><Input required value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="tutor-phone" /></div>
            <div><Label className="text-[#0A1128]">Kata Sandi</Label><Input required type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="tutor-password" /></div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#FF9F1C] hover:bg-[#e88f10] text-[#0A1128]" data-testid="tutor-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Lanjut ke Unggah Berkas <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[#475569]">Mendaftar sebagai siswa? <Link to="/register" className="text-[#4361EE] font-semibold hover:underline">Daftar Siswa</Link></p>
        </div>
      </div>
    </div>
  );
}
