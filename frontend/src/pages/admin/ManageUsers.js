import { useState } from "react";
import { Plus, Trash2, Users, School, ShieldCheck, GraduationCap, UserCog } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const ROLE_BADGE = {
  admin: { l: "Admin", c: "#7C3AED", bg: "#F5F3FF" },
  student: { l: "Siswa", c: "#4361EE", bg: "#EEF2FF" },
  tutor: { l: "Tentor", c: "#FF9F1C", bg: "#FFF4E5" },
  proctor: { l: "Proktor", c: "#10B981", bg: "#ECFDF5" },
};
const EMPTY = { name: "", email: "", password: "", role: "tutor", phone: "", school_id: "", qualifications: "" };

export default function ManageUsers() {
  const { data: users, loading, refetch } = useFetch("/admin/users");
  const { data: schools, refetch: refetchSchools } = useFetch("/admin/schools");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [schoolForm, setSchoolForm] = useState({ name: "", city: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const list = (users || []).filter((u) => tab === "all" || u.role === tab);

  const save = async () => {
    const payload = {
      ...form,
      school_id: form.school_id || null,
      qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try { await api.post("/admin/users", payload); toast.success("Pengguna dibuat"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/users/${id}`); toast.success("Pengguna dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };
  const saveSchool = async () => {
    try { await api.post("/admin/schools", schoolForm); toast.success("Sekolah ditambahkan"); setSchoolOpen(false); setSchoolForm({ name: "", city: "" }); refetchSchools(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="manage-users">
      <PageHeader title="Pengguna & Sekolah Mitra" subtitle="Kelola akun tentor, proktor, dan siswa serta daftar sekolah mitra."
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setSchoolOpen(true)} className="rounded-full hover:bg-[#EEF2FF] hover:text-[#4361EE]" data-testid="add-school-btn"><School className="h-4 w-4" /> Tambah Sekolah</Button>
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#4361EE] hover:bg-[#344ED0]" data-testid="add-user-btn"><Plus className="h-4 w-4" /> Tambah Pengguna</Button>
        </div>} />

      {/* Schools row */}
      <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(schools || []).map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-3" data-testid={`school-${s.id}`}>
            <div className="h-10 w-10 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"><School className="h-5 w-5" /></div>
            <div><p className="font-semibold text-[#0A1128] text-sm">{s.name}</p><p className="text-xs text-[#94A3B8]">{s.city} · {s.student_count} siswa</p></div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList data-testid="user-tabs">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="tutor">Tentor</TabsTrigger>
          <TabsTrigger value="proctor">Proktor</TabsTrigger>
          <TabsTrigger value="student">Siswa</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Loading /> : !list.length ? (
        <Empty icon={Users} title="Tidak ada pengguna" />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F4F7FE]">
                <TableHead>Nama</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead className="hidden md:table-cell">Sekolah / Kualifikasi</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => {
                const b = ROLE_BADGE[u.role] || ROLE_BADGE.student;
                return (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell><p className="font-medium text-[#0A1128]">{u.name}</p><p className="text-xs text-[#94A3B8]">{u.email}</p></TableCell>
                    <TableCell><span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: b.c, backgroundColor: b.bg }}>{b.l}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#475569]">{u.school_name || (u.qualifications?.length ? u.qualifications.join(", ") : "-")}</TableCell>
                    <TableCell>
                      {u.role !== "admin" && (
                        <ConfirmButton onConfirm={() => del(u.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-user-${u.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create user */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tambah Pengguna</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nama</Label><Input value={form.name} onChange={set("name")} className="mt-1.5" data-testid="user-name" /></div>
              <div><Label>Peran</Label>
                <Select value={form.role} onValueChange={set("role")}>
                  <SelectTrigger className="mt-1.5" data-testid="user-role"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="tutor">Tentor</SelectItem><SelectItem value="proctor">Proktor</SelectItem><SelectItem value="student">Siswa</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} className="mt-1.5" data-testid="user-email" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kata Sandi</Label><Input value={form.password} onChange={set("password")} className="mt-1.5" data-testid="user-password" /></div>
              <div><Label>Telepon</Label><Input value={form.phone} onChange={set("phone")} className="mt-1.5" data-testid="user-phone" /></div>
            </div>
            {(form.role === "proctor" || form.role === "student") && (
              <div><Label>Sekolah</Label>
                <Select value={form.school_id} onValueChange={set("school_id")}>
                  <SelectTrigger className="mt-1.5" data-testid="user-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                  <SelectContent>{(schools || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.role === "tutor" && (
              <div><Label>Kualifikasi (pisahkan dengan koma)</Label><Input value={form.qualifications} onChange={set("qualifications")} placeholder="Matematika, Fisika" className="mt-1.5" data-testid="user-quals" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-user">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create school */}
      <Dialog open={schoolOpen} onOpenChange={setSchoolOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Sekolah Mitra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Sekolah</Label><Input value={schoolForm.name} onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5" data-testid="school-name" /></div>
            <div><Label>Kota</Label><Input value={schoolForm.city} onChange={(e) => setSchoolForm((f) => ({ ...f, city: e.target.value }))} className="mt-1.5" data-testid="school-city" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchoolOpen(false)}>Batal</Button>
            <Button onClick={saveSchool} className="bg-[#4361EE] hover:bg-[#344ED0]" data-testid="save-school">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
