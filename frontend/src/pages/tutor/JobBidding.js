import { useState } from "react";
import { Gavel, Clock, CheckCircle2, Lock, Send } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const BID_STATUS = {
  pending: { l: "Menunggu", c: "#FF9F1C", bg: "#FFF4E5" },
  accepted: { l: "Diterima", c: "#10B981", bg: "#ECFDF5" },
  rejected: { l: "Ditolak", c: "#EF4444", bg: "#FEF2F2" },
};

export default function JobBidding() {
  const { data, loading, refetch } = useFetch("/tutor/slots/open");
  const [target, setTarget] = useState(null);
  const [message, setMessage] = useState("");

  const submitBid = async () => {
    try {
      await api.post(`/tutor/slots/${target.id}/bid`, { message });
      toast.success("Bidding terkirim! Menunggu konfirmasi admin.");
      setTarget(null); setMessage(""); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="job-bidding">
      <PageHeader title="Job Bidding" subtitle="Ajukan diri untuk slot mengajar terbuka. Sistem memeriksa kualifikasi Anda secara otomatis." />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={Gavel} title="Belum ada slot terbuka" desc="Slot mengajar baru dari admin akan muncul di sini." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col hover:-translate-y-1 transition-transform duration-200" data-testid={`bid-slot-${s.id}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F4F7FE] px-3 py-1 text-[11px] font-semibold text-[#475569]">{s.subject}</span>
                <span className="text-xs text-[#94A3B8]">{formatDate(s.date)}</span>
              </div>
              <h3 className="mt-4 font-semibold text-[#0A1128]">{s.title}</h3>
              <p className="mt-1 text-xs text-[#94A3B8] flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</p>
              {s.notes && <p className="mt-2 text-sm text-[#475569] line-clamp-2">{s.notes}</p>}
              <div className="mt-3">
                <p className="text-xs text-[#94A3B8]">Syarat kualifikasi:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.required_qualifications?.length ? s.required_qualifications.map((q) => (
                    <span key={q} className="rounded-full bg-[#EEF2FF] text-[#4361EE] px-2.5 py-0.5 text-[11px] font-medium">{q}</span>
                  )) : <span className="text-xs text-[#94A3B8]">Tidak ada</span>}
                </div>
              </div>
              <div className="mt-5 flex-1 flex items-end">
                {s.my_bid_status ? (
                  <span className="w-full text-center rounded-full py-2 text-sm font-semibold" style={{ color: BID_STATUS[s.my_bid_status].c, backgroundColor: BID_STATUS[s.my_bid_status].bg }} data-testid={`bid-status-${s.id}`}>
                    Bidding: {BID_STATUS[s.my_bid_status].l}
                  </span>
                ) : s.qualified ? (
                  <Button className="w-full rounded-full bg-[#FF9F1C] hover:bg-[#e88f10] text-[#0A1128] font-semibold" onClick={() => setTarget(s)} data-testid={`bid-btn-${s.id}`}><Gavel className="h-4 w-4" /> Ajukan Bidding</Button>
                ) : (
                  <span className="w-full text-center rounded-full py-2 text-sm font-medium bg-[#F4F7FE] text-[#94A3B8] flex items-center justify-center gap-1"><Lock className="h-4 w-4" /> Kualifikasi tidak memenuhi</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={() => setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajukan Bidding — {target?.title}</DialogTitle></DialogHeader>
          <div>
            <Label>Pesan untuk Admin (opsional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1.5" placeholder="Ceritakan pengalaman relevan Anda..." data-testid="bid-message" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
            <Button onClick={submitBid} className="bg-[#FF9F1C] hover:bg-[#e88f10] text-[#0A1128]" data-testid="submit-bid"><Send className="h-4 w-4" /> Kirim Bidding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
