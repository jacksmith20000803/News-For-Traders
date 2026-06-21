export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIStreamResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  sources?: { title: string; url: string }[];
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  chat(messages: AIMessage[]): Promise<AIStreamResult>;
  chatStream(messages: AIMessage[], onChunk: (text: string) => void): Promise<AIStreamResult>;
}

const API_KEY = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? "";
const BASE_URL = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  isConfigured(): boolean {
    return API_KEY.length > 0;
  }

  async chat(messages: AIMessage[]): Promise<AIStreamResult> {
    let full = "";
    return this.chatStream(messages, (chunk) => { full += chunk; });
  }

  async chatStream(messages: AIMessage[], onChunk: (text: string) => void): Promise<AIStreamResult> {
    if (!this.isConfigured()) {
      throw new Error("AI provider not configured.");
    }

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are MarketPulse AI, a professional financial market analyst. Provide concise, evidence-based analysis. Never give direct financial advice. Cite sources when possible.",
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI provider error: ${res.status} ${err.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const text = parsed.choices?.[0]?.delta?.content ?? "";
          if (text) {
            fullContent += text;
            onChunk(text);
          }
        } catch {
          // skip malformed SSE chunk
        }
      }
    }

    return {
      content: fullContent,
      promptTokens: 0,
      completionTokens: Math.ceil(fullContent.length / 4),
    };
  }
}

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!provider) provider = new OpenAICompatibleProvider();
  return provider;
}

export function isAIConfigured(): boolean {
  return getAIProvider().isConfigured();
}
