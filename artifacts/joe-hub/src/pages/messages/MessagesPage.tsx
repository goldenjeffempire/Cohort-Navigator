import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, Circle } from "lucide-react";
import { useConversations, useMessages, useSendMessage, useCreateConversation } from "@/lib/community";
import type { Message, Conversation } from "@/lib/community";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function InitialsAvatar({ name, avatarUrl, size = "md" }: { name?: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sz} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function relativeTime(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(date).toLocaleDateString();
}

function ChatPane({
  conversation,
  currentUserId,
}: {
  conversation: Conversation;
  currentUserId: number | undefined;
}) {
  const { data: messages = [], refetch } = useMessages(conversation.id);
  const sendMutation = useSendMessage(conversation.id);
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync with fetched messages
  useEffect(() => {
    if (messages.length > 0) setLocalMessages(messages as Message[]);
  }, [messages]);

  // SSE for real-time
  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/api/conversations/${conversation.id}/events`);
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "message") {
          setLocalMessages((prev) => {
            if (prev.find((m) => m.id === payload.data.id)) return prev;
            return [...prev, payload.data];
          });
        } else if (payload.type === "deleted") {
          setLocalMessages((prev) => prev.filter((m) => m.id !== payload.data.id));
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [conversation.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    sendMutation.mutate(
      { body: text },
      {
        onSuccess: (msg: any) => {
          setLocalMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const title =
    conversation.title ??
    ((conversation as any).participants as any[])
      ?.filter((p: any) => p.userId !== currentUserId)
      .map((p: any) => p.name)
      .join(", ") ??
    "Conversation";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <InitialsAvatar name={title} />
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground capitalize">{conversation.kind.replace("_", " ")}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {localMessages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {!isMe && <InitialsAvatar name={msg.senderName} avatarUrl={msg.senderAvatarUrl} size="sm" />}
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!isMe && <p className="text-xs font-medium mb-0.5 opacity-70">{msg.senderName}</p>}
                <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                <p className={`text-xs mt-1 opacity-60 text-right`}>
                  {relativeTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2 flex-shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="resize-none text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { data: conversations = [], isLoading } = useConversations();
  const createMutation = useCreateConversation();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");

  const selected = (conversations as Conversation[]).find((c) => c.id === selectedId) ?? null;

  // Pre-fetch selected conversation with participants
  const { data: fullConversation } = useConversations();

  const handleNewDm = () => {
    const targetId = parseInt(newUserId.trim(), 10);
    if (Number.isNaN(targetId)) {
      toast({ title: "Enter a valid user ID", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      { kind: "dm", participantIds: [targetId] },
      {
        onSuccess: (conv: any) => {
          setSelectedId(conv.id);
          setNewDmOpen(false);
          setNewUserId("");
        },
        onError: () => toast({ title: "Failed to start conversation", variant: "destructive" }),
      },
    );
  };

  // Resolve current user's local DB id from conversations (heuristic)
  const myDbId = selected
    ? ((selected as any).participants as any[])?.find(
        (p: any) => p.userId !== undefined && user?.id !== undefined,
      )?.userId
    : undefined;

  return (
    <div className="h-[calc(100vh-4rem)] flex border rounded-lg overflow-hidden mx-4 my-4">
      {/* Left sidebar — conversation list */}
      <div className="w-72 border-r flex flex-col flex-shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Messages</h2>
          <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Enter user ID to message"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  type="number"
                />
                <Button
                  className="w-full"
                  onClick={handleNewDm}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Starting…" : "Start Conversation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (conversations as Conversation[]).length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No conversations yet
            </div>
          ) : (
            (conversations as any[]).map((conv: any) => {
              const isActive = conv.id === selectedId;
              const title =
                conv.title ??
                (conv.participants as any[])
                  ?.filter((p: any) => p.userId !== myDbId)
                  .map((p: any) => p.name)
                  .join(", ") ??
                `Conversation ${conv.id}`;

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-muted/60 transition-colors border-b ${isActive ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {title[0]?.toUpperCase() ?? "?"}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center text-[9px] text-primary-foreground font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{title}</p>
                        {conv.latestMessage && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                            {relativeTime(conv.latestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {conv.latestMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.latestMessage.body}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane — chat */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Select a conversation</p>
            <p className="text-sm mt-1">or start a new one</p>
          </div>
        ) : (
          <ChatPane conversation={selected} currentUserId={undefined} />
        )}
      </div>
    </div>
  );
}
