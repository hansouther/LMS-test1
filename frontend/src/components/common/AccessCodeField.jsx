import { KeyRound, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => CHARS[n % CHARS.length]).join("").replace(/^(.{4})/, "$1-");

export const AccessCodeField = ({ value, onChange, testIdPrefix }) => {
  const copy = () => { navigator.clipboard?.writeText(value); toast.success("Kode disalin"); };
  return (
    <div className="rounded-lg border border-[#E2E8F0] p-3" data-testid={`${testIdPrefix}-field`}>
      <Label className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-[#C9A227]" /> Kode Akses <span className="text-[#94A3B8] font-normal">(opsional)</span></Label>
      <div className="mt-2 flex gap-2">
        <Input value={value || ""} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="Kosongkan = terbuka untuk semua"
          className="font-mono2 tracking-wider uppercase" data-testid={`${testIdPrefix}-input`} />
        <Button type="button" variant="outline" size="icon" onClick={() => onChange(randomCode())} title="Buat kode acak" data-testid={`${testIdPrefix}-generate`}><RefreshCw className="h-4 w-4" /></Button>
        {value && <Button type="button" variant="outline" size="icon" onClick={copy} title="Salin kode" data-testid={`${testIdPrefix}-copy`}><Copy className="h-4 w-4" /></Button>}
      </div>
      <p className="mt-1.5 text-xs text-[#94A3B8]">Jika diisi, hanya siswa yang memasukkan kode ini yang bisa ikut. Bagikan kode ke siswa pilihan Anda. 4–32 karakter (huruf, angka, -).</p>
    </div>
  );
};

export const LockBadge = ({ code, testId }) => code ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A227]/40 bg-[#FBF3DC] px-2.5 py-0.5 text-[11px] font-semibold text-[#8A6D12]" data-testid={testId}>
    <KeyRound className="h-3 w-3" /> Kode: <span className="font-mono2">{code}</span>
  </span>
) : null;
