import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const LEVELS = [
  { id: "SD", label: "SD Sederajat" },
  { id: "SMP", label: "SMP Sederajat" },
  { id: "SMA", label: "SMA Sederajat" },
];

export function useSchoolClasses(schoolId) {
  const [classes, setClasses] = useState(null);
  useEffect(() => {
    if (!schoolId) { setClasses([]); return; }
    setClasses(null);
    api.get(`/public/schools/${schoolId}/classes`).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [schoolId]);
  return classes;
}

// value: { level, class_id, grade } — onChange(patch)
export default function ClassPicker({ schoolId, value, onChange, testPrefix = "class" }) {
  const classes = useSchoolClasses(schoolId);
  const official = (classes || []).length > 0;
  const levels = official ? LEVELS.filter((l) => classes.some((c) => c.level === l.id)) : LEVELS;
  const options = (classes || []).filter((c) => c.level === value.level);

  useEffect(() => {
    if (!official || !value.class_id) return;
    const c = classes.find((x) => x.id === value.class_id);
    if (!c) onChange({ class_id: "" });
    else if (c.level !== value.level) onChange({ level: c.level });
  }, [classes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" data-testid={`${testPrefix}-picker`}>
      <div className="min-w-0">
        <Label className="text-[#0A1128]">Jenjang</Label>
        <Select value={value.level || ""} onValueChange={(v) => onChange({ level: v, class_id: "" })}>
          <SelectTrigger className="mt-1.5 h-11" data-testid={`${testPrefix}-level`}><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
          <SelectContent>
            {levels.map((l) => <SelectItem key={l.id} value={l.id} data-testid={`${testPrefix}-level-${l.id}`}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0">
        <Label className="text-[#0A1128]">Kelas</Label>
        {official ? (
          <Select key={classes.length} value={value.class_id || ""} onValueChange={(v) => onChange({ class_id: v })} disabled={!value.level}>
            <SelectTrigger className="mt-1.5 h-11" data-testid={`${testPrefix}-select`}><SelectValue placeholder={value.level ? "Pilih kelas" : "Pilih jenjang dulu"} /></SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map((c) => <SelectItem key={c.id} value={c.id} data-testid={`${testPrefix}-opt-${c.label}`}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input required value={value.grade || ""} onChange={(e) => onChange({ grade: e.target.value })} placeholder={schoolId ? "Contoh: XII-1" : "Pilih sekolah dulu"}
            disabled={!schoolId} className="mt-1.5 h-11" data-testid={`${testPrefix}-text`} />
        )}
      </div>
      {schoolId && classes && !official && <p className="col-span-2 text-[11px] text-[#94A3B8]">Sekolah ini belum punya daftar kelas resmi. Tulis kelas Anda sesuai data sekolah.</p>}
    </div>
  );
}
