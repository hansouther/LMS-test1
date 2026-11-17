import { useEffect, useState } from "react";
import { MessagesSquare, Users } from "lucide-react";
import api, { apiError } from "@/lib/api";
import useFetch from "@/hooks/useFetch";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageList, Composer, useChatPolling } from "@/components/chat/ChatParts";
import { toast } from "sonner";

function MemberStrip({ info }) {
  const [open, setOpen] = useState(false);
  if (!info) return null;
  const people = [...(info.tutor ? [{ ...info.tutor, tutor: true }] : []), ...info.students];
  return (
    <div className="px-4 pb-2">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-xs text-[#475569] hover:text-[#0E7490]" data-testid="class-chat-members-toggle">
        <div className="flex -space-x-2">
          {people.slice(0, 5).map((p) => (
            <span key={p.id} className="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: p.tutor ? "#C9A227" : "#0E7490" }}>{(p.name || "?").slice(0, 1).toUpperCase()}</span>
          ))}
        </div>
        <Users className="h-3.5 w-3.5" /> {info.member_count} anggota
      </button>
      {open && (
        <div className="mt-2 max-h-28 overflow-y-auto flex flex-wrap gap-1.5" data-testid="class-chat-member-list">
          {people.map((p) => (
            <span key={p.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${p.tutor ? "bg-[#FBF3DC] text-[#8A6D12]" : "bg-[#EFF6F8] text-[#0A1128]"}`}>{p.name}{p.tutor ? " · Tentor" : ""}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export const ClassChatDialog = ({ cls, onClose }) => {
  const { user } = useAuth();
  const { data: info } = useFetch(`/class-chat/${cls.id}/info`);
  const url = `/class-chat/${cls.id}/messages`;
  const { messages, push, remove } = useChatPolling(url, true);
  const canModerate = user?.role !== "student";
  const roster = info ? [...(info.tutor ? [{ ...info.tutor, role: "tutor" }] : []), ...info.students.map((x) => ({ ...x, role: "student" }))] : [];
  const mentionable = [...(canModerate ? [{ id: "all", name: "semua" }] : []), ...roster.filter((p) => p.id !== user?.id)];

  const send = async (body) => { const { data } = await api.post(url, body); push(data); };
  const del = async (m) => {
    try { await api.delete(`${url}/${m.id}`); remove(m.id); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 h-[85dvh] flex flex-col overflow-hidden" data-testid="class-chat-dialog">
        <DialogHeader className="p-4 pb-2 text-left">
          <DialogTitle className="flex items-center gap-2"><MessagesSquare className="h-5 w-5 text-[#0E7490]" /> Chat Kelas — {cls.title}</DialogTitle>
          <DialogDescription>Ruang diskusi bersama tentor dan teman sekelas. Tanya, bagikan catatan, dan saling bantu.</DialogDescription>
        </DialogHeader>
        <MemberStrip info={info} />
        <MessageList messages={messages} ownId={user?.id} group canDelete={canModerate} onDelete={del}
          memberNames={roster.map((p) => p.name)} meName={user?.name}
          emptyText="Belum ada obrolan. Mulai sapa teman sekelasmu!" />
        <Composer onSend={send} testPrefix="class-chat" members={info ? mentionable : undefined} />
      </DialogContent>
    </Dialog>
  );
};

export const ClassChatButton = ({ cls, unread = 0, onOpen }) => (
  <button onClick={(e) => { e.stopPropagation(); onOpen(cls); }}
    className="relative inline-flex items-center gap-1.5 rounded-full border border-[#0E7490]/30 bg-[#E6F5F8] px-3 h-9 text-xs font-semibold text-[#0E7490] hover:bg-[#0E7490] hover:text-white transition-colors duration-150"
    data-testid={`class-chat-btn-${cls.id}`}>
    <MessagesSquare className="h-4 w-4" /> Chat Kelas
    {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center" data-testid={`class-chat-unread-${cls.id}`}>{unread}</span>}
  </button>
);

export const useClassChatUnread = () => {
  const { data, refetch } = useFetch("/class-chat/unread");
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) refetch(); }, 15000);
    return () => clearInterval(t);
  }, [refetch]);
  return { byClass: data?.by_class || {}, refetch };
};
