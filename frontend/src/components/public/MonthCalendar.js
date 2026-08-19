import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/format";

export const TYPE_COLOR = { exam: "#EF4444", deadline: "#FF9F1C", holiday: "#10B981", event: "#7C3AED", academic: "#4361EE" };
export const TYPE_LABEL = { exam: "Ujian", deadline: "Tenggat", holiday: "Libur", event: "Acara", academic: "Akademik" };
const WD = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function MonthCalendar({ events = [], initialDate, showList = true, compact = false }) {
  const start = useMemo(() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [initialDate]);
  const [cursor, setCursor] = useState(start);
  const [selectedDay, setSelectedDay] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      const d = new Date(e.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] = map[day] || []).push(e);
      }
    }
    return map;
  }, [events, year, month]);

  const monthEvents = useMemo(() => {
    return events
      .filter((e) => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() === month; })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events, year, month]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const nav = (delta) => { setSelectedDay(null); setCursor(new Date(year, month + delta, 1)); };

  return (
    <div data-testid="month-calendar">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0A1128] text-white">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#FF9F1C]" />
            <span className="font-head font-bold text-lg" data-testid="calendar-month-label">{MONTHS[month]} {year}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => nav(-1)} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200" data-testid="calendar-prev"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => nav(1)} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200" data-testid="calendar-next"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Weekday row */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#94A3B8] border-b border-[#E2E8F0]">
          {WD.map((w) => (<div key={w} className="py-2">{w}</div>))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} className={compact ? "h-12" : "h-20"} />;
            const dayEvents = eventsByDay[day] || [];
            const active = selectedDay === day;
            return (
              <button key={day} onClick={() => setSelectedDay(active ? null : day)} data-testid={`calendar-day-${day}`}
                className={`${compact ? "h-12" : "h-20"} border-b border-r border-[#F1F5F9] p-1.5 text-left align-top relative transition-colors duration-200 ${active ? "bg-[#EEF2FF]" : "hover:bg-[#F8FAFC]"}`}>
                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${isToday(day) ? "bg-[#4361EE] text-white" : "text-[#0A1128]"}`}>{day}</span>
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dayEvents.slice(0, compact ? 3 : 4).map((ev, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[ev.type] || "#4361EE" }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {Object.entries(TYPE_LABEL).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-[#475569]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[k] }} /> {label}
          </span>
        ))}
      </div>

      {/* Event list for selected day or whole month */}
      {showList && (
        <div className="mt-5" data-testid="calendar-events-list">
          <h3 className="text-sm font-semibold text-[#94A3B8] mb-3">
            {selectedDay ? `Agenda ${selectedDay} ${MONTHS[month]}` : `Agenda ${MONTHS[month]} ${year}`}
          </h3>
          <div className="space-y-2">
            {(selectedDay ? (eventsByDay[selectedDay] || []) : monthEvents).map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3" data-testid={`calendar-event-${c.id}`}>
                <div className="h-11 w-11 rounded-lg flex flex-col items-center justify-center text-white shrink-0" style={{ backgroundColor: TYPE_COLOR[c.type] || "#4361EE" }}>
                  <span className="text-sm font-bold leading-none">{new Date(c.date).getDate()}</span>
                  <span className="text-[9px] uppercase">{new Date(c.date).toLocaleDateString("id-ID", { month: "short" })}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#0A1128]">{c.title}</p>
                  {c.description && <p className="text-xs text-[#475569] mt-0.5">{c.description}</p>}
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{formatDate(c.date)} · {TYPE_LABEL[c.type] || "Agenda"}</p>
                </div>
              </div>
            ))}
            {(selectedDay ? (eventsByDay[selectedDay] || []).length === 0 : monthEvents.length === 0) && (
              <p className="text-sm text-[#94A3B8]">Tidak ada agenda pada periode ini.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
