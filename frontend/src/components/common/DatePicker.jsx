import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function DatePicker({ value, onChange, testid, placeholder = "Pilih tanggal" }) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal text-left h-10" data-testid={testid}>
          <CalendarIcon className="h-4 w-4 text-[#94A3B8]" />
          {value ? format(date, "dd MMM yyyy") : <span className="text-[#94A3B8]">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
