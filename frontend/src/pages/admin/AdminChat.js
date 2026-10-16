import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, Search } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { MessageList, Composer, useChatPolling } from "@/components/chat/ChatParts";

const ago = (iso) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function ThreadList({ threads, active, onPick, q, setQ }) {
  const list = threads.filter((t) => `${t.student_name} ${t.student_email} ${t.school_name || ""} ${t.grade || ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-[#E2E8F0]">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari siswa, sekolah, kelas" className="pl-9 h-10" data-testid="chat-thread-search" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="chat-thread-list">
        {list.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-10">Belum ada chat masuk</p>}
        {list.map((t) => (
          <button key={t.id} onClick={() => onPick(t)} data-testid={`chat-thread-${t.student_id}`}
            className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] flex gap-3 transition-colors duration-150 ${active === t.student_id ? "bg-[#E6F5F8]" : "hover:bg-[#F8FAFC]"}`}>
            <div className="h-10 w-10 shrink-0 rounded-full bg-[#0E7490]/10 text-[#0E7490] flex items-center justify-center font-bold text-sm">{(t.student_name || "?").slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-[#0A1128] truncate flex-1">{t.student_name}</p>
                <span className="text-[10px] text-[#94A3B8] shrink-0">{ago(t.last_at)}</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] truncate">{[t.school_name, t.grade].filter(Boolean).join(" · ") || t.student_email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs truncate flex-1 ${t.unread_admin ? "text-[#0A1128] font-semibold" : "text-[#475569]"}`}>{t.last_role === "admin" ? "Anda: " : ""}{t.last_text}</p>
                {t.unread_admin > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center" data-testid={`chat-thread-unread-${t.student_id}`}>{t.unread_admin}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminChat() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState("");
  const url = active ? `/admin/chat/threads/${active.student_id}/messages` : null;
  const { messages, push } = useChatPolling(url, !!active);

  useEffect(() => {
    let alive = true;
    const load = () => api.get("/admin/chat/threads").then((r) => alive && setThreads(r.data)).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const current = useMemo(() => threads.find((t) => t.student_id === active?.student_id) || active, [threads, active]);
  const send = async (body) => { const { data } = await api.post(`/admin/chat/threads/${active.student_id}/messages`, body); push(data); };
  const pick = (t) => { setActive(t); setTimeout(() => window.dispatchEvent(new Event("admin-chat-read")), 800); setThreads((ts) => ts.map((x) => (x.id === t.id ? { ...x, unread_admin: 0 } : x))); };

  return (
    <div data-testid="admin-chat-page">
      <PageHeader title="Chat Siswa" subtitle="Pertanyaan yang dikirim siswa dari tombol chat di LMS. Balas langsung di sini." />
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden grid md:grid-cols-[320px_1fr] h-[calc(100dvh-13rem)] min-h-[420px]">
        <div className={`${active ? "hidden md:flex" : "flex"} flex-col min-h-0 border-r border-[#E2E8F0]`}>
          <ThreadList threads={threads} active={active?.student_id} onPick={pick} q={q} setQ={setQ} />
        </div>
        <div className={`${active ? "flex" : "hidden md:flex"} flex-col min-h-0 min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#94A3B8] gap-2 p-6 text-center"><MessageCircle className="h-10 w-10" /><p className="text-sm">Pilih percakapan di sebelah kiri</p></div>
          ) : (
            <>
              <div className="h-14 shrink-0 flex items-center gap-3 px-3 border-b border-[#E2E8F0]" data-testid="chat-active-header">
                <button onClick={() => setActive(null)} className="md:hidden p-2 rounded-lg hover:bg-[#E6F5F8]" aria-label="Kembali" data-testid="chat-back"><ArrowLeft className="h-5 w-5" /></button>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#0A1128] truncate">{current.student_name}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">{[current.school_name, current.grade, current.student_email].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <MessageList messages={messages} mine="admin" emptyText="Belum ada pesan." />
              <Composer onSend={send} testPrefix="admin-chat" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
