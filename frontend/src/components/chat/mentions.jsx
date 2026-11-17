import { Fragment } from "react";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Active "@query" right before the caret, or null.
export const mentionQuery = (text, caret) => {
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
  return m ? { query: m[2], start: caret - m[2].length - 1 } : null;
};

// Members whose "@Name" appears in the text (picked from the list or typed manually).
export const resolveMentions = (text, members) =>
  [...new Set(members.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id))];

export function MentionText({ text, names = [], meName, own }) {
  const list = [...new Set([...names, "semua"])].filter(Boolean).sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(${list.map(escapeRe).join("|")})`, "g");
  const parts = text.split(re);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => i % 2 === 1 ? (
        <span key={i} className={`font-semibold rounded px-0.5 ${own ? "bg-white/20 text-white" : part === meName || part === "semua" ? "bg-[#FDE68A] text-[#78350F]" : "text-[#0E7490]"}`}>@{part}</span>
      ) : <Fragment key={i}>{part}</Fragment>)}
    </p>
  );
}

export function MentionPicker({ options, activeIndex, onPick }) {
  if (!options.length) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 max-h-56 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1 z-50" data-testid="mention-picker">
      <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#94A3B8]">Sebut anggota</p>
      {options.map((o, i) => (
        <button key={o.id} type="button" onMouseDown={(e) => { e.preventDefault(); onPick(o); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${i === activeIndex ? "bg-[#E6F5F8]" : "hover:bg-[#F8FAFC]"}`}
          data-testid={`mention-option-${o.id}`}>
          <span className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: o.id === "all" ? "#EF4444" : o.role === "tutor" ? "#C9A227" : "#0E7490" }}>
            {o.id === "all" ? "@" : (o.name || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[#0A1128]">{o.name}</span>
          {o.role === "tutor" && <span className="ml-auto text-[10px] font-semibold text-[#8A6D12]">Tentor</span>}
          {o.id === "all" && <span className="ml-auto text-[10px] text-[#94A3B8]">semua anggota</span>}
        </button>
      ))}
    </div>
  );
}
