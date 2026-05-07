import React, { useState } from "react";
import { History, Plus, Trash2, MoreHorizontal, Download, Copy, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatConversationMeta } from "@/hooks/useChatHistory";

interface Props {
  conversations: ChatConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyAll: () => void;
  onDownloadMd: () => void;
  onDownloadTxt: () => void;
  onClear: () => void;
  hasMessages: boolean;
}

const ChatHistoryMenu: React.FC<Props> = ({
  conversations,
  activeId,
  onNew,
  onSwitch,
  onDelete,
  onCopyAll,
  onDownloadMd,
  onDownloadTxt,
  onClear,
  hasMessages,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md px-2.5 py-1.5 transition-colors"
        title="Start a new conversation"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New</span>
      </button>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md px-2.5 py-1.5 transition-colors"
            title="Conversation history"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-h-[60vh] overflow-y-auto">
          <DropdownMenuLabel>Past conversations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground italic">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className="flex items-stretch group">
                <button
                  onClick={() => { onSwitch(c.id); setOpen(false); }}
                  className={`flex-1 text-left px-2 py-2 text-[13px] rounded-sm hover:bg-muted/60 transition-colors min-w-0 ${
                    activeId === c.id ? "bg-muted/80 font-medium" : ""
                  }`}
                >
                  <p className="truncate">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(c.last_message_at).toLocaleDateString()} · {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  className="opacity-0 group-hover:opacity-100 px-2 text-muted-foreground hover:text-destructive transition-opacity"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!hasMessages}
            className="flex items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onCopyAll} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy entire conversation
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownloadMd} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Download as Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownloadTxt} className="gap-2">
            <FileText className="h-3.5 w-3.5" /> Download as plain text
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClear} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Clear this conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ChatHistoryMenu;