import api, { apiError } from "@/lib/api";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Handshake, Mail, Phone, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS = {
  new: { l: "Baru", c: "#0E7490", bg: "#E6F5F8" },
  contacted: { l: "Dihubungi", c: "#C9A227", bg: "#FBF3DC" },
  accepted: { l: "Diterima", c: "#10B981", bg: "#ECFDF5" },
  rejected: { l: "Ditolak", c: "#EF4444", bg: "#FEF2F2" },
};

export default function ManagePartnerships() {
  const { data, loading, refetch } = useFetch("/admin/partnerships");

  const update = async (id, status) => {
    try { await api.put(`/admin/partnerships/${id}?status=${status}`); toast.success("Status diperbarui"); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="manage-partnerships">
      <PageHeader title="Pengajuan Kemitraan" subtitle="Kelola permintaan kerja sama yang masuk dari landing page." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={Handshake} title="Belum ada pengajuan" />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {data.map((p) => {
            const st = STATUS[p.status] || STATUS.new;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`partnership-${p.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0A1128]">{p.org_name}</h3>
                    <p className="text-xs text-[#94A3B8]">{p.org_type} · PIC: {p.contact_name}</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }}>{st.l}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-[#475569]">
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#94A3B8]" /> {p.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#94A3B8]" /> {p.phone}</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-[#94A3B8]" /> ± {p.student_count} siswa</p>
                </div>
                {p.message && <p className="mt-3 text-sm text-[#475569] rounded-lg bg-[#EFF6F8] p-3">{p.message}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">{formatDate(p.created_at)}</span>
                  <Select value={p.status} onValueChange={(v) => update(p.id, v)}>
                    <SelectTrigger className="w-40 h-9" data-testid={`status-${p.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
