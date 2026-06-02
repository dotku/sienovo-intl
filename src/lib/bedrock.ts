import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

// AWS Bedrock — Claude on our own AWS account (cross-project AI infra,
// mirrors the setup in autoclaw-web). Newest Claude models are reached via
// cross-region inference profiles, so the model ids are prefixed "us.".
// Region defaults to us-east-2 (Ohio). Everything is env-overridable so we
// can swap models/region without a code change.
export const BEDROCK_REGION = process.env.AWS_BEDROCK_REGION || "us-east-2";
export const BEDROCK_SONNET_MODEL_ID =
  process.env.BEDROCK_SONNET_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
export const BEDROCK_HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID ||
  "us.anthropic.claude-haiku-4-5-20251001-v1:0";
// Primary model for chat. Defaults to Sonnet 4.6 for quality; point this at
// BEDROCK_HAIKU_MODEL_ID's value to trade quality for lower cost/latency.
export const BEDROCK_CHAT_MODEL_ID =
  process.env.BEDROCK_CHAT_MODEL_ID || BEDROCK_SONNET_MODEL_ID;

// Bedrock is usable whenever the shared AWS credentials are present.
export function bedrockConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
  );
}

let _client: BedrockRuntimeClient | null = null;
function client(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: BEDROCK_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BedrockResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Calls a Bedrock Claude model via the Anthropic Messages API shape
 * (`anthropic_version: bedrock-2023-05-31`). `system` is the system prompt;
 * `messages` is the alternating user/assistant history (must start with a
 * user turn and alternate, per the Messages API contract).
 */
export async function bedrockChat(
  messages: BedrockMessage[],
  opts: { model?: string; maxTokens?: number; system?: string } = {},
): Promise<BedrockResult> {
  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: opts.maxTokens ?? 16384,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.system) body.system = opts.system;

  const res = await client().send(
    new InvokeModelCommand({
      modelId: opts.model || BEDROCK_CHAT_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    }),
  );

  const data = JSON.parse(new TextDecoder().decode(res.body)) as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: data.content?.map((c) => c.text || "").join("") || "",
    usage: data.usage
      ? {
          inputTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0,
        }
      : undefined,
  };
}

/**
 * Streaming variant of {@link bedrockChat}. The initial request is awaited
 * before returning, so auth/model errors surface synchronously and the caller
 * can fall back to another provider. Returns an async iterable of text deltas.
 */
export async function bedrockChatStream(
  messages: BedrockMessage[],
  opts: { model?: string; maxTokens?: number; system?: string } = {},
): Promise<AsyncIterable<string>> {
  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: opts.maxTokens ?? 4096,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.system) body.system = opts.system;

  const res = await client().send(
    new InvokeModelWithResponseStreamCommand({
      modelId: opts.model || BEDROCK_CHAT_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    }),
  );

  async function* deltas(): AsyncGenerator<string> {
    if (!res.body) return;
    for await (const event of res.body) {
      const bytes = event.chunk?.bytes;
      if (!bytes) continue;
      try {
        const data = JSON.parse(new TextDecoder().decode(bytes)) as {
          type?: string;
          delta?: { text?: string };
        };
        // Anthropic streaming emits incremental text via content_block_delta.
        if (data.type === "content_block_delta" && data.delta?.text) {
          yield data.delta.text;
        }
      } catch {
        // skip malformed event
      }
    }
  }

  return deltas();
}
