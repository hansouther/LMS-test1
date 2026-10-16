import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { fileUrl } from "@/lib/media";
import { toast } from "sonner";

const time = (iso) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function MessageList({ messages, mine, emptyText }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 bg-[#F4F8FA]" data-testid="chat-messages">
      {messages.length === 0 && <p className="text-center text-sm text-[#94A3B8] py-10 px-4">{emptyText}</p>}
      {messages.map((m) => {
        const own = m.sender_role === mine;
        return (
          <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.id}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${own ? "bg-[#0E7490] text-white rounded-br-md" : "bg-white text-[#0A1128] border border-[#E2E8F0] rounded-bl-md"}`}>
              {!own && m.sender_role === "admin" && <p className="text-[10px] font-bold text-[#0E7490] mb-0.5">Admin</p>}
              {m.image_url && (
                <a href={fileUrl(m.image_url)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(m.image_url)} alt="lampiran" className="rounded-lg max-h-56 w-auto mb-1 bg-white" onLoad={() => end.current?.scrollIntoView({ block: "end" })} data-testid="chat-msg-image" />
                </a>
              )}
              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              <p className={`text-[10px] mt-0.5 text-right ${own ? "text-white/70" : "text-[#94A3B8]"}`}>{time(m.created_at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Composer({ onSend, testPrefix = "chat" }) {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 5 MB");
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/chat/upload", fd);
      setImg(data.url);
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  const send = async (e) => {
    e.preventDefault();
    if (busy || (!text.trim() && !img)) return;
    setBusy(true);
    try { await onSend({ text: text.trim(), image_url: img }); setText(""); setImg(null); }
    catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={send} className="border-t border-[#E2E8F0] bg-white p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]" data-testid={`${testPrefix}-composer`}>
      {img && (
        <div className="relative inline-block mb-2">
          <img src={fileUrl(img)} alt="pratinjau" className="h-16 rounded-lg border border-[#E2E8F0]" data-testid={`${testPrefix}-image-preview`} />
          <button type="button" onClick={() => setImg(null)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[#0A1128] text-white flex items-center justify-center" aria-label="Hapus gambar"><X className="h-3 w-3" /></button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} data-testid={`${testPrefix}-file`} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="h-10 w-10 shrink-0 rounded-full text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490] flex items-center justify-center transition-colors duration-150" aria-label="Kirim gambar" data-testid={`${testPrefix}-attach`}>
          <ImagePlus className="h-5 w-5" />
        </button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Tulis pesan..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) send(e); }}
          className="flex-1 min-w-0 resize-none max-h-28 rounded-2xl border border-[#D5DDE3] px-3 py-2 text-sm focus:outline-none focus:border-[#0E7490]" data-testid={`${testPrefix}-input`} />
        <button type="submit" disabled={busy || (!text.trim() && !img)} className="h-10 w-10 shrink-0 rounded-full bg-[#0E7490] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0B5C74] transition-colors duration-150" aria-label="Kirim" data-testid={`${testPrefix}-send`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}

// Polling pesan baru tiap `interval` ms selama `active`
export function useChatPolling(url, active, interval = 4000) {
  const [messages, setMessages] = useState([]);
  const last = useRef(null);
  useEffect(() => { setMessages([]); last.current = null; }, [url]);
  useEffect(() => {
    if (!active || !url) return;
    let alive = true;
    const tick = () => api.get(url, { params: last.current ? { after: last.current } : {} }).then((r) => {
      if (!alive || !r.data.length) return;
      last.current = r.data[r.data.length - 1].created_at;
      setMessages((m) => { const ids = new Set(m.map((x) => x.id)); return [...m, ...r.data.filter((x) => !ids.has(x.id))]; });
    }).catch(() => {});
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, interval);
    return () => { alive = false; clearInterval(t); };
  }, [url, active, interval]);
  const push = (msg) => { last.current = msg.created_at; setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg])); };
  return { messages, push };
}
