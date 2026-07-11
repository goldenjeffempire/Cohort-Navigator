/**
 * AI Tutor — full-page learning assistant chat.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useAIConversations, useCreateAIConversation, useDeleteAIConversation,
  streamAIMessage, useAIFeedback, customFetch,
  type AIConversation, type AIMessage, type AIMode,
} from "@/lib/ai";
import { customFetch as cf } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  BotMessageSquare, Plus, Trash2, Send, ThumbsUp, ThumbsDown,
  Loader2, Sparkles, MessageCircle, Search,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MODE_LABELS: Record<AIMode, string> = {
  tutor: "📚 Tutor", code: "💻 Code", assignment: "📝 Assignment",
  interview: "🎯 Interview", career: "🚀 Career",
  quiz: "❓ Quiz", review: "🔍 Review", general: "💬 General",
};

function MessageBubble({ msg, onFeedback }: { msg: AIMessage; onFeedback: (id: number, helpful: boolean) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-5`}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarFallback className="bg-primary text-white text-xs">JOE</AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[70%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-white rounded-br-sm" : "bg-white border border-gray-100 shadow-sm rounded-bl-sm"}`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{msg.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex gap-1 px-1">
            <button onClick={() => onFeedback(msg.id, true)} className="text-gray-300 hover:text-green-500 transition-colors p-0.5">
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button onClick={() => onFeedback(msg.id, false)} className="text-gray-300 hover:text-red-500 transition-colors p-0.5">
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AITutor() {
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMode, setSelectedMode] = useState<AIMode>("tutor");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>();
  const { data: conversations, refetch } = useAIConversations();
  const createMutation = useCreateAIConversation();
  const deleteMutation = useDeleteAIConversation();
  const feedbackMutation = useAIFeedback();

  const activeConv = conversations?.find((c) => c.id === activeConvId);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText]);

  const openConv = async (id: number) => {
    const data = await cf<AIConversation & { messages: AIMessage[] }>(`/api/ai/conversations/${id}`);
    setMessages(data.messages ?? []);
    setActiveConvId(id);
  };

  const createConv = async () => {
    const conv = await createMutation.mutateAsync({ mode: selectedMode, title: `${MODE_LABELS[selectedMode]} session` });
    await refetch();
    setMessages([]);
    setActiveConvId(conv.id);
  };

  const deleteConv = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteMutation.mutateAsync(id);
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !activeConvId) return;
    setInput("");
    setStreaming(true);
    setStreamingText("");

    setMessages((prev) => [...prev, { id: Date.now(), conversationId: activeConvId, role: "user", content: text, createdAt: new Date().toISOString() }]);

    let acc = "";
    abortRef.current = new AbortController();
    await streamAIMessage(activeConvId, text, {}, {
      onChunk: (c) => { acc += c; setStreamingText(acc); },
      onDone: (msgId) => {
        setMessages((prev) => [...prev, { id: msgId ?? Date.now() + 1, conversationId: activeConvId, role: "assistant", content: acc, createdAt: new Date().toISOString() }]);
        setStreamingText(""); setStreaming(false);
      },
      onError: (e) => { setStreamingText(""); setStreaming(false); },
    }, abortRef.current.signal);
  }, [input, streaming, activeConvId]);

  const filteredConvs = conversations?.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold text-gray-900">AI Tutor</span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="pl-8 h-8 text-xs" />
          </div>
          <div className="flex gap-1 flex-wrap mb-2">
            {(["tutor", "code", "interview", "career"] as AIMode[]).map((m) => (
              <button key={m} onClick={() => setSelectedMode(m)} className={`text-xs px-2 py-1 rounded-full border transition-all ${selectedMode === m ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:border-primary/50"}`}>
                {MODE_LABELS[m].split(" ")[0]} {m}
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={createConv} disabled={createMutation.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {filteredConvs.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-400 mt-8">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
              No conversations yet
            </div>
          )}
          {filteredConvs.map((conv) => (
            <button key={conv.id} onClick={() => openConv(conv.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left group transition-colors ${activeConvId === conv.id ? "bg-primary/5 border-r-2 border-primary" : "hover:bg-gray-50"}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{conv.title}</div>
                <div className="text-xs text-gray-400">{MODE_LABELS[conv.mode]}</div>
              </div>
              <button onClick={(e) => deleteConv(e, conv.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-50/50">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <BotMessageSquare className="h-12 w-12 mx-auto mb-4 text-primary/30" />
              <h3 className="font-display font-semibold text-gray-700 mb-1">Select or start a conversation</h3>
              <p className="text-sm text-gray-400 mb-4">Choose a mode and create a new session to get started with your AI learning assistant.</p>
              <Button onClick={createConv}><Plus className="h-4 w-4 mr-1" /> Start Session</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-6 py-3 border-b bg-white shrink-0">
              <BotMessageSquare className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{activeConv?.title}</div>
                <div className="text-xs text-gray-400">{activeConv ? MODE_LABELS[activeConv.mode] : ""} • Self-hosted AI</div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-6">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/20" />
                  <p className="text-sm font-medium">How can I help you today?</p>
                  <p className="text-xs mt-1">Ask me anything about your courses, code, or career.</p>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onFeedback={(id, helpful) =>
                  feedbackMutation.mutate({ messageId: id, rating: helpful ? 5 : 1, helpful })} />
              ))}
              {streamingText && (
                <div className="flex gap-3 mb-5">
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-primary text-white text-xs">JOE</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[70%] bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <div className="prose prose-sm max-w-none text-gray-800">
                      <ReactMarkdown>{streamingText}</ReactMarkdown>
                    </div>
                    <div className="flex gap-0.5 mt-2">
                      {[0,1,2].map((i) => <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </ScrollArea>
            <div className="p-4 border-t bg-white shrink-0">
              <div className="flex gap-3 items-end max-w-4xl mx-auto">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
                  className="min-h-[44px] max-h-36 text-sm resize-none" disabled={streaming} />
                <Button onClick={send} disabled={!input.trim() || streaming} className="h-11 px-4 shrink-0">
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">JOE AI • Self-hosted learning platform</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
