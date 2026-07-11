/**
 * AIChat — floating global chat widget
 * Accessible from every page via a floating button.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import {
  useAIConversations,
  useCreateAIConversation,
  useDeleteAIConversation,
  streamAIMessage,
  useAIFeedback,
  type AIConversation,
  type AIMessage,
  type AIMode,
} from "@/lib/ai";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  BotMessageSquare, X, Plus, Trash2, Send, ThumbsUp, ThumbsDown,
  Loader2, ChevronLeft, Sparkles, MessageCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MODE_LABELS: Record<AIMode, string> = {
  tutor: "📚 Tutor",
  code: "💻 Code",
  assignment: "📝 Assignment",
  interview: "🎯 Interview",
  career: "🚀 Career",
  quiz: "❓ Quiz",
  review: "🔍 Review",
  general: "💬 General",
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-gray max-w-none text-sm leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

interface ChatPanelProps {
  conversation: AIConversation & { messages?: AIMessage[] };
  onBack: () => void;
  context?: Record<string, unknown>;
}

function ChatPanel({ conversation, onBack, context = {} }: ChatPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>();
  const feedbackMutation = useAIFeedback();

  // Load existing messages
  useEffect(() => {
    customFetch<AIMessage[]>(`/api/ai/conversations/${conversation.id}/messages`)
      .then(setMessages)
      .catch(() => {});
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);
    setStreaming(true);
    setStreamingText("");

    const userMsg: AIMessage = {
      id: Date.now(),
      conversationId: conversation.id,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = "";
    abortRef.current = new AbortController();

    await streamAIMessage(
      conversation.id,
      text,
      context,
      {
        onChunk: (chunk) => { accumulated += chunk; setStreamingText(accumulated); },
        onDone: (msgId) => {
          setMessages((prev) => [
            ...prev,
            { id: msgId ?? Date.now() + 1, conversationId: conversation.id, role: "assistant", content: accumulated, createdAt: new Date().toISOString() },
          ]);
          setStreamingText("");
          setStreaming(false);
        },
        onError: (err) => { setError(err); setStreaming(false); setStreamingText(""); },
      },
      abortRef.current.signal,
    );
  }, [input, streaming, conversation.id, context]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">{conversation.title}</div>
          <div className="text-xs text-gray-400">{MODE_LABELS[conversation.mode]}</div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-8 text-gray-400">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/30" />
            <p className="text-sm">Ask me anything!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
              msg.role === "user"
                ? "bg-primary text-white rounded-br-sm"
                : "bg-gray-50 border border-gray-100 rounded-bl-sm"
            }`}>
              {msg.role === "assistant" ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              {msg.role === "assistant" && (
                <div className="flex gap-1 mt-1.5 justify-end">
                  <button onClick={() => feedbackMutation.mutate({ messageId: msg.id, rating: 5, helpful: true })} className="text-gray-300 hover:text-green-500 transition-colors">
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => feedbackMutation.mutate({ messageId: msg.id, rating: 1, helpful: false })} className="text-gray-300 hover:text-red-500 transition-colors">
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {streamingText && (
          <div className="flex justify-start mb-3">
            <div className="max-w-[85%] bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
              <MarkdownMessage content={streamingText} />
              <div className="flex gap-0.5 mt-1">
                {[0, 1, 2].map((i) => <div key={i} className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-500 text-center py-2">{error}</div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t bg-white shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send)"
            className="min-h-[38px] max-h-24 text-sm resize-none"
            disabled={streaming}
          />
          <Button size="icon" onClick={send} disabled={!input.trim() || streaming} className="shrink-0 h-[38px] w-[38px]">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">JOE AI • Self-hosted</p>
      </div>
    </div>
  );
}

interface AIChatProps {
  context?: Record<string, unknown>;
  defaultMode?: AIMode;
}

export default function AIChat({ context = {}, defaultMode = "tutor" }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [activeConv, setActiveConv] = useState<(AIConversation & { messages?: AIMessage[] }) | null>(null);
  const { data: me } = useGetMe();
  const { data: conversations, refetch } = useAIConversations();
  const createMutation = useCreateAIConversation();
  const deleteMutation = useDeleteAIConversation();

  const openConversation = async (id: number) => {
    const conv = await customFetch<AIConversation & { messages: AIMessage[] }>(`/api/ai/conversations/${id}`);
    setActiveConv(conv);
    setActiveConvId(id);
  };

  const createNew = async (mode: AIMode = defaultMode) => {
    const conv = await createMutation.mutateAsync({ mode, title: `${MODE_LABELS[mode]} chat` });
    await refetch();
    setActiveConv(conv);
    setActiveConvId(conv.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteMutation.mutateAsync(id);
    if (activeConvId === id) { setActiveConvId(null); setActiveConv(null); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${open ? "bg-gray-800 scale-95" : "bg-primary hover:bg-primary/90"}`}
        title="AI Assistant"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <BotMessageSquare className="h-6 w-6 text-white" />}
        {!open && conversations && conversations.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
            {conversations.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {activeConv && activeConvId ? (
            <ChatPanel
              conversation={activeConv}
              onBack={() => { setActiveConvId(null); setActiveConv(null); refetch(); }}
              context={context}
            />
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-transparent shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-semibold text-gray-900">JOE AI Assistant</h3>
                </div>
                <p className="text-xs text-gray-500">Self-hosted learning AI for JOE Hub</p>
              </div>

              {/* Mode picker */}
              <div className="p-3 border-b shrink-0">
                <p className="text-xs text-gray-500 mb-2">Start new conversation:</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["tutor", "code", "assignment", "interview", "career", "quiz", "review", "general"] as AIMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => createNew(mode)}
                      className="text-xs p-1.5 rounded-lg bg-gray-50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all text-center leading-tight"
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation list */}
              <ScrollArea className="flex-1">
                {!conversations?.length ? (
                  <div className="p-6 text-center text-gray-400">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No conversations yet.</p>
                    <p className="text-xs mt-1">Pick a mode above to start!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left group"
                        onClick={() => openConversation(conv.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{conv.title}</div>
                          <div className="text-xs text-gray-400">{MODE_LABELS[conv.mode]}</div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </>
  );
}
