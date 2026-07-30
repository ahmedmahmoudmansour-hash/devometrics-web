const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterJsonResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

type JsonSchemaNode = {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  [key: string]: unknown;
};

// OpenAI/OpenRouter's strict json_schema mode requires `additionalProperties:
// false` at every object level, not just the top — Anthropic's tool
// input_schema (which every existing call site already defines) doesn't need
// this, so callers can otherwise pass their existing schema almost as-is.
// Every call site's schema already lists every property as required (no
// optional fields), so that half of strict mode's requirement is already met.
function toStrictSchema(schema: JsonSchemaNode): JsonSchemaNode {
  if (schema.type === "object" && schema.properties) {
    const properties: Record<string, JsonSchemaNode> = {};
    for (const key of Object.keys(schema.properties)) {
      properties[key] = toStrictSchema(schema.properties[key]);
    }
    return { ...schema, properties, additionalProperties: false };
  }
  if (schema.type === "array" && schema.items) {
    return { ...schema, items: toStrictSchema(schema.items) };
  }
  return schema;
}

function parseJsonContent<T>(content: string): T {
  const cleaned = content.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

async function callOnce<T>(
  params: { model: string; system: string; user: string; maxTokens: number },
  responseFormat: Record<string, unknown> | null
): Promise<OpenRouterJsonResult<T>> {
  const r = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });
  if (!r.ok) {
    throw new Error(`OpenRouter ${r.status} (${params.model}): ${await r.text()}`);
  }
  const json = await r.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter (${params.model}) returned no content`);
  return {
    data: parseJsonContent<T>(content),
    model: json.model ?? params.model,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

// One shared call for every "system + user, want JSON back" drafting call
// site — avoids duplicating raw-fetch/JSON-schema-conversion logic across
// 7+ files. Tries OpenAI-compatible strict json_schema structured output
// first; on any failure (non-2xx, no content, or unparsable JSON — some
// OpenRouter-routed models don't reliably support strict mode, per this
// session's own testing), retries once with the schema described in the
// prompt instead of enforced via response_format, matching the fallback
// this session's throwaway test scripts already used successfully. Every
// call site wraps this in its own try/catch with a user-facing "couldn't
// generate right now" message, so a final failure here surfaces the same
// way an Anthropic call failing already does today.
export async function callOpenRouterJson<T>(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  jsonSchema: { name: string; schema: Record<string, unknown> };
}): Promise<OpenRouterJsonResult<T>> {
  try {
    return await callOnce<T>(params, {
      type: "json_schema",
      json_schema: { name: params.jsonSchema.name, strict: true, schema: toStrictSchema(params.jsonSchema.schema) },
    });
  } catch (err) {
    console.error(`callOpenRouterJson strict mode failed for ${params.model}, retrying without response_format:`, err);
    const fallbackSystem = `${params.system}\n\nReturn ONLY a JSON object matching this shape, no prose before or after:\n${JSON.stringify(params.jsonSchema.schema)}`;
    return await callOnce<T>({ ...params, system: fallbackSystem }, null);
  }
}
