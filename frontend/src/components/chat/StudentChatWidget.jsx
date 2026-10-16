import { useEffect, useState } from "react";
import { MessageCircle, X, Headset } from "lucide-react";
import api from "@/lib/api";
import { MessageList, Composer, useChatPolling } from "@/components/chat/ChatParts";

export default function StudentChatWidget() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [typing, setTyping] = useState(false);
  const { messages, push } = useChatPolling("/chat/messages", open);

  useEffect(() => {
    const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el?.getAttribute?.("role") === "combobox";
    const onIn = (e) => setTyping(isField(e.target) && !e.target.closest("[data-testid=student-chat-panel]"));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);

  useEffect(() => {
    if (open) return;
    const load = () => api.get("/chat/unread").then((r) => setUnread(r.data.count || 0)).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open && messages.length) api.post("/chat/read").then(() => setUnread(0)).catch(() => {});
  }, [open, messages.length]);

  const send = async (body) => { const { data } = await api.post("/chat/messages", body); push(data); };

  return (
    <>
      {open && (
        <div className="fixed z-50 inset-x-0 bottom-0 top-[max(4rem,env(safe-area-inset-top))] sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100vh-8rem)] flex flex-col bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden" data-testid="student-chat-panel">
          <div className="flex items-center gap-3 px-4 h-14 shrink-0 bg-[#0A1128] text-white">
            <div className="h-9 w-9 rounded-full bg-[#0E7490] flex items-center justify-center"><Headset className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-tight">Tanya Admin</p>
              <p className="text-[11px] text-white/60 truncate">Pesan dibalas admin secepatnya</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-white/10" aria-label="Tutup chat" data-testid="student-chat-close"><X className="h-5 w-5" /></button>
          </div>
          <MessageList messages={messages} mine="student" emptyText="Ada yang ingin ditanyakan tentang materi atau LMS? Tulis pesan atau kirim foto, admin akan membalas di sini." />
          <Composer onSend={send} testPrefix="student-chat" />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className={`fixed z-50 right-4 sm:right-6 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 h-14 w-14 rounded-full bg-[#0E7490] text-white shadow-lg shadow-[#0E7490]/40 flex items-center justify-center hover:bg-[#0B5C74] hover:scale-105 transition-transform duration-200 ${open ? "hidden sm:flex" : ""} ${typing && !open ? "max-sm:hidden" : ""}`}
        aria-label="Chat admin" data-testid="student-chat-button">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#EF4444] text-[11px] font-bold flex items-center justify-center border-2 border-white" data-testid="student-chat-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
    </>
  );
}
