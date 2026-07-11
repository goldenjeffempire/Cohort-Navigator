/**
 * AI Inference Engine
 *
 * Abstraction layer that supports:
 *  1. Any Ollama-compatible local model server  (AI_MODEL_ENDPOINT env var)
 *  2. Built-in retrieval-augmented response engine (no external dependencies)
 *
 * Usage:
 *   const engine = createInferenceEngine();
 *   for await (const chunk of engine.stream(messages, opts)) { ... }
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InferenceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface InferenceResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  modelUsed: string;
  fromLocal: boolean;
}

export type StreamChunk = { content: string; done: false } | { done: true; result: InferenceResult };

// ─── Ollama / OpenAI-compatible client ────────────────────────────────────────

async function* streamOllama(
  endpoint: string,
  messages: ChatMessage[],
  opts: InferenceOptions,
): AsyncGenerator<StreamChunk> {
  const model = opts.model ?? "llama3.2";
  const start = Date.now();
  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        num_predict: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
      },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n").filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        const delta = parsed.message?.content ?? "";
        if (delta) {
          fullContent += delta;
          outputTokens++;
          yield { content: delta, done: false };
        }
        if (parsed.eval_count) inputTokens = parsed.prompt_eval_count ?? inputTokens;
        if (parsed.done) break;
      } catch {
        // skip malformed lines
      }
    }
  }

  yield {
    done: true,
    result: {
      content: fullContent,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      modelUsed: model,
      fromLocal: true,
    },
  };
}

// ─── Built-in retrieval engine ────────────────────────────────────────────────

import { retrievalEngine } from "../knowledge/retrieval.js";

async function* streamBuiltIn(
  messages: ChatMessage[],
  opts: InferenceOptions,
): AsyncGenerator<StreamChunk> {
  const start = Date.now();
  const userMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";

  const response = await retrievalEngine.generateResponse(userMsg, systemMsg, messages);
  const words = response.split(" ");
  let full = "";

  // Simulate token-by-token streaming
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    full += chunk;
    yield { content: chunk, done: false };
    // Natural pacing — faster for short responses
    if (words.length > 50) await new Promise((r) => setTimeout(r, 12));
  }

  yield {
    done: true,
    result: {
      content: full,
      inputTokens: Math.ceil(response.length / 4),
      outputTokens: Math.ceil(full.length / 4),
      latencyMs: Date.now() - start,
      modelUsed: "joe-rag-v1",
      fromLocal: false,
    },
  };
}

// ─── Engine factory ───────────────────────────────────────────────────────────

export function createInferenceEngine() {
  const endpoint = process.env.AI_MODEL_ENDPOINT?.trim();

  return {
    /**
     * Check whether a real local model server is reachable.
     */
    async ping(): Promise<boolean> {
      if (!endpoint) return false;
      try {
        const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
      } catch {
        return false;
      }
    },

    /**
     * Stream a response. Falls back to built-in engine if no local server is set.
     */
    async *stream(
      messages: ChatMessage[],
      opts: InferenceOptions = {},
    ): AsyncGenerator<StreamChunk> {
      if (endpoint) {
        try {
          yield* streamOllama(endpoint, messages, opts);
          return;
        } catch (err) {
          console.error("[ai-engine] Local model failed, falling back to built-in:", err);
        }
      }
      yield* streamBuiltIn(messages, opts);
    },

    /**
     * Non-streaming complete (for batch tasks).
     */
    async complete(messages: ChatMessage[], opts: InferenceOptions = {}): Promise<InferenceResult> {
      let result: InferenceResult | null = null;
      for await (const chunk of this.stream(messages, opts)) {
        if (chunk.done) result = chunk.result;
      }
      if (!result) throw new Error("Inference produced no result");
      return result;
    },
  };
}

export type InferenceEngine = ReturnType<typeof createInferenceEngine>;

// Singleton
export const inferenceEngine = createInferenceEngine();
