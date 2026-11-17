import { useState } from "react";
import { KeyRound, Loader2, MessageCircle, Lock } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const CONTACT_WA = "https://wa.me/628159896773";
const LABEL = { course: "kursus", tryout: "try out" };

export const UnlockDialog = ({ item, itemType, open, onOpenChange, onUnlocked }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = (v) => { if (!v) { setCode(""); setError(""); } onOpenChange(v); };

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setError("");
    try {
      await api.post("/student/unlock", { item_type: itemType, item_id: item.id, code });
      toast.success(`Kode benar! ${LABEL[itemType] === "kursus" ? "Kursus" : "Try Out"} sudah terbuka untukmu.`);
      close(false);
      onUnlocked?.(item);
    } catch (err) {
      setError(apiError(err));
    } finally { setBusy(false); }
  };

  const waText = encodeURIComponent(`Halo Binara LMS, saya tertarik ikut ${LABEL[itemType]} "${item?.title || ""}". Bagaimana cara mendapatkan kode aksesnya?`);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md" data-testid="unlock-dialog">
        <DialogHeader>
          <div className="h-11 w-11 rounded-full bg-[#FBF3DC] flex items-center justify-center mb-2"><Lock className="h-5 w-5 text-[#C9A227]" /></div>
          <DialogTitle>Masukkan Kode Akses</DialogTitle>
          <DialogDescription>
            {item?.title} hanya untuk siswa tertentu. Masukkan kode yang dibagikan oleh gurumu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Contoh: UTBK-2026"
            className="font-mono2 tracking-widest text-center uppercase h-12 text-base" data-testid="unlock-code-input" />
          {error && (
            <div className="rounded-xl border border-[#F5C2C2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B] space-y-3" data-testid="unlock-error-message">
              <p>{error}</p>
              <a href={`${CONTACT_WA}?text=${waText}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#10B981] hover:bg-[#0ea371] px-4 py-2 text-xs font-semibold text-white transition-colors" data-testid="unlock-contact-button">
                <MessageCircle className="h-4 w-4" /> Hubungi Binara LMS
              </a>
            </div>
          )}
          <Button type="submit" disabled={busy || !code.trim()} className="w-full rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="unlock-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Buka dengan Kode
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
