import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", school_id: "" });
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (user && user.role) navigate(roleHome(user.role), { replace: true });
    api.get("/public/schools").then((r) => setSchools(r.data)).catch(() => {});
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, school_id: form.school_id || null };
      const { data } = await api.post("/auth/register", payload);
      setUser(data);
      toast.success("Akun berhasil dibuat!");
      navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F4F7FE]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-[#4361EE] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <span className="font-head font-bold text-xl text-[#0A1128]">CendekiaLMS</span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0A1128]">Daftar sebagai Siswa</h1>
          <p className="mt-2 text-sm text-[#475569]">Sudah punya akun? <Link to="/login" className="text-[#4361EE] font-semibold hover:underline">Masuk</Link></p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="register-form">
            <div>
              <Label className="text-[#0A1128]">Nama Lengkap</Label>
              <Input required value={form.name} onChange={set("name")} placeholder="Nama Anda" className="mt-1.5 h-11" data-testid="register-name" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Email</Label>
              <Input required type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" className="mt-1.5 h-11" data-testid="register-email" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Kata Sandi</Label>
              <Input required type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="register-password" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Asal Sekolah (opsional)</Label>
              <Select value={form.school_id} onValueChange={set("school_id")}>
                <SelectTrigger className="mt-1.5 h-11" data-testid="register-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="register-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Buat Akun <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
