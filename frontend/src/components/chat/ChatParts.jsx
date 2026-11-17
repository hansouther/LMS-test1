import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X, Trash2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { fileUrl } from "@/lib/media";
import { toast } from "sonner";
import { MentionText, MentionPicker, mentionQuery, resolveMentions } from "@/components/chat/mentions";

const time = (iso) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const ROLE_TAG = { tutor: ["Tentor", "#C9A227"], admin: ["Admin", "#0E7490"] };

export function MessageList({ messages, mine, emptyText, ownId, group, canDelete, onDelete, memberNames, meName }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 bg-[#F4F8FA]" data-testid="chat-messages">
      {messages.length === 0 && <p className="text-center text-sm text-[#94A3B8] py-10 px-4">{emptyText}</p>}
      {messages.map((m) => {
        const own = ownId ? m.sender_id === ownId : m.sender_role === mine;
        const tag = ROLE_TAG[m.sender_role];
        const mentionsMe = !own && (m.mention_all || (m.mentions || []).some((x) => x.id === ownId));
        return (
          <div key={m.id} className={`group flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.id}`}>
            {group && !own && <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: tag ? tag[1] : "#475569" }}>{(m.sender_name || "?").slice(0, 1).toUpperCase()}</div>}
            {onDelete && (own || canDelete) && <button onClick={() => onDelete(m)} className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[#94A3B8] hover:text-red-600 transition-opacity ${own ? "order-first" : "order-last"}`} aria-label="Hapus pesan" data-testid={`chat-msg-delete-${m.id}`}><Trash2 className="h-3.5 w-3.5" /></button>}
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${own ? "bg-[#0E7490] text-white rounded-br-md" : mentionsMe ? "bg-[#FFFBEB] text-[#0A1128] border-2 border-[#FCD34D] rounded-bl-md" : "bg-white text-[#0A1128] border border-[#E2E8F0] rounded-bl-md"}`} data-mention-me={mentionsMe || undefined}>
              {!own && group && <p className="text-[11px] font-bold mb-0.5 flex items-center gap-1.5" style={{ color: tag ? tag[1] : "#475569" }}>{m.sender_name}{tag && <span className="rounded-full px-1.5 text-[9px] text-white" style={{ backgroundColor: tag[1] }}>{tag[0]}</span>}</p>}
              {!own && !group && m.sender_role === "admin" && <p className="text-[10px] font-bold text-[#0E7490] mb-0.5">Admin</p>}
              {m.image_url && (
                <a href={fileUrl(m.image_url)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(m.image_url)} alt="lampiran" className="rounded-lg max-h-56 w-auto mb-1 bg-white" onLoad={() => end.current?.scrollIntoView({ block: "end" })} data-testid="chat-msg-image" />
                </a>
              )}
              {m.text && (group ? <MentionText text={m.text} names={[...(memberNames || []), ...(m.mentions || []).map((x) => x.name)]} meName={meName} own={own} /> : <p className="whitespace-pre-wrap break-words">{m.text}</p>)}
              <p className={`text-[10px] mt-0.5 text-right ${own ? "text-white/70" : "text-[#94A3B8]"}`}>{time(m.created_at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Composer({ onSend, testPrefix = "chat", members }) {
  const [text, setText] = useState("");
  const [mq, setMq] = useState(null);
  const [mIdx, setMIdx] = useState(0);
  const taRef = useRef(null);
  const caretRef = useRef(null);
  useLayoutEffect(() => {
    if (caretRef.current == null || !taRef.current) return;
    taRef.current.focus();
    taRef.current.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  }, [text]);
  const options = mq && members ? members.filter((o) => o.name.toLowerCase().includes(mq.query.toLowerCase())).slice(0, 8) : [];

  const onType = (e) => {
    setText(e.target.value);
    setMq(members ? mentionQuery(e.target.value, e.target.selectionStart) : null);
    setMIdx(0);
  };
  const pickMention = (o) => {
    const caret = taRef.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mq.start)}@${o.name} ${text.slice(caret)}`;
    caretRef.current = mq.start + o.name.length + 2;
    setText(next); setMq(null);
  };
  const onKey = (e) => {
    if (options.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMIdx((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(options[mIdx]); return; }
      if (e.key === "Escape") { setMq(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) send(e);
  };
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
    const body = { text: text.trim(), image_url: img };
    if (members) body.mentions = resolveMentions(text, members);
    try { await onSend(body); setText(""); setImg(null); setMq(null); }
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
        <div className="relative flex-1 min-w-0 flex">
        <MentionPicker options={options} activeIndex={mIdx} onPick={pickMention} />
        <textarea ref={taRef} value={text} onChange={onType} rows={1} maxLength={2000} placeholder={members ? "Tulis pesan... ketik @ untuk menyebut teman" : "Tulis pesan..."}
          onKeyDown={onKey} onBlur={() => setTimeout(() => setMq(null), 150)}
          className="flex-1 min-w-0 resize-none max-h-28 rounded-2xl border border-[#D5DDE3] px-3 py-2 text-sm focus:outline-none focus:border-[#0E7490]" data-testid={`${testPrefix}-input`} />
        </div>
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
      const fresh = r.data.filter((x) => !x.deleted);
      const gone = new Set(r.data.filter((x) => x.deleted).map((x) => x.id));
      if (fresh.length) last.current = fresh[fresh.length - 1].created_at;
      setMessages((m) => { const ids = new Set(m.map((x) => x.id)); return [...m.filter((x) => !gone.has(x.id)), ...fresh.filter((x) => !ids.has(x.id))]; });
    }).catch(() => {});
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, interval);
    return () => { alive = false; clearInterval(t); };
  }, [url, active, interval]);
  const push = (msg) => { last.current = msg.created_at; setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg])); };
  const remove = (id) => setMessages((m) => m.filter((x) => x.id !== id));
  return { messages, push, remove };
}
