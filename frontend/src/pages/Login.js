import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEMO = [
  { role: "Admin", email: "admin@lms.id", pass: "Admin@12345" },
  { role: "Siswa", email: "siswa@lms.id", pass: "Siswa@12345" },
  { role: "Tentor", email: "tutor@lms.id", pass: "Tutor@12345" },
  { role: "Proktor", email: "proktor@lms.id", pass: "Proktor@12345" },
];

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      toast.success(`Selamat datang, ${data.name}!`);
      if (data.status && data.status !== "approved" && data.role !== "admin") navigate("/pending", { replace: true });
      else navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/student";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const fill = (d) => { setEmail(d.email); setPassword(d.pass); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#0A1128] text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#4361EE]/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#FF9F1C]/20 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-[#4361EE] flex items-center justify-center"><GraduationCap className="h-5 w-5" /></div>
          <span className="font-head font-bold text-xl">CendekiaLMS</span>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">Belajar cerdas,<br />pantau prestasi.</h2>
          <p className="mt-4 text-white/70 max-w-md">Masuk ke portal Anda — Admin, Siswa, Tentor, atau Proktor. Semua terhubung dalam satu sistem yang aman.</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60"><ShieldCheck className="h-4 w-4 text-[#10B981]" /> Autentikasi berbasis peran (RBAC)</div>
        </div>
        <p className="relative text-xs text-white/40">© 2026 CendekiaLMS</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-[#F4F7FE]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-xl bg-[#4361EE] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
            <span className="font-head font-bold text-lg text-[#0A1128]">CendekiaLMS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1128]">Masuk ke akun Anda</h1>
          <p className="mt-2 text-sm text-[#475569]">Belum punya akun siswa? <Link to="/register" className="text-[#4361EE] font-semibold hover:underline">Daftar di sini</Link> · <Link to="/register/proktor" className="text-[#10B981] font-semibold hover:underline" data-testid="login-link-proctor">Daftar Proktor</Link></p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <Label className="text-[#0A1128]">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="mt-1.5 h-11" data-testid="login-email" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Kata Sandi</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 h-11" data-testid="login-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="login-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Masuk <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-[#94A3B8]"><div className="flex-1 h-px bg-[#E2E8F0]" />ATAU<div className="flex-1 h-px bg-[#E2E8F0]" /></div>

          <Button variant="outline" onClick={googleLogin} className="w-full h-11 rounded-full border-[#CBD5E1] hover:bg-white" data-testid="google-login-btn">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-5 w-5" /> Masuk dengan Google
          </Button>

          <div className="mt-8 rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-xs font-semibold text-[#475569] mb-2">Akun demo (klik untuk isi otomatis):</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button key={d.role} onClick={() => fill(d)} type="button" data-testid={`demo-${d.role.toLowerCase()}`}
                  className="text-left rounded-lg border border-[#E2E8F0] px-3 py-2 hover:border-[#4361EE] hover:bg-[#EEF2FF] transition-colors duration-200">
                  <p className="text-xs font-bold text-[#0A1128]">{d.role}</p>
                  <p className="text-[10px] text-[#94A3B8] truncate">{d.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
