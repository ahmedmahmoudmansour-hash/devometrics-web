import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A real 3-5-bullet answer (trend summary or course list) is always well
// over 100 chars — anything under this generous floor is treated as
// failed, and never handed to onSuccess (so a bad generation can't get
// cached or otherwise treated as a good result).
const MIN_VALID_LENGTH = 80;

export type GroundedSearchStreamOptions = {
  userPrompt: string;
  errorMessages: Record<Anthropic.WebSearchToolResultErrorCode, string>;
  /** Streamed when the model returns successfully but the result is empty/too short. */
  emptyResultFallback: string;
  /** Streamed when the call throws (network error, SDK error, etc). */
  exceptionFallback: string;
  /** Best-effort — called after the stream closes on a valid result. Its own errors are caught and logged, never surfaced to the client. */
  onSuccess?: (finalText: string, finalMessage: Anthropic.Message) => Promise<void>;
};

// Shared by /api/trends and /api/courses — both are "search the web, stream
// a grounded bulleted-list answer" jobs that differ only in the prompt, the
// per-error-code copy, and what (if anything) happens after a successful
// generation (trends caches the result; courses records AI usage). See
// app/api/trends/route.ts's header comment for why this is a single call
// with the basic web_search_20250305 tool rather than the old two-phase
// web_search_20260209 pattern.
export function runGroundedSearchStream({
  userPrompt,
  errorMessages,
  emptyResultFallback,
  exceptionFallback,
  onSuccess,
}: GroundedSearchStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const searchTool = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 4 };
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 1536,
          tools: [searchTool],
          messages: [{ role: "user", content: userPrompt }],
        });

        let finalText = "";
        let searchErrorCode: Anthropic.WebSearchToolResultErrorCode | null = null;
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "web_search_tool_result") {
            const c = event.content_block.content;
            // Success content is a list; an error is a single object.
            if (!Array.isArray(c) && c && typeof c === "object" && "error_code" in c) {
              searchErrorCode = (c as Anthropic.WebSearchToolResultError).error_code;
            }
          }
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            finalText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // The search runs before any text, so an error block always arrives
        // before the first text_delta — nothing has been streamed to the
        // client yet at this point.
        if (searchErrorCode && !finalText) {
          console.error("Web search tool error:", searchErrorCode);
          controller.enqueue(encoder.encode(errorMessages[searchErrorCode] ?? emptyResultFallback));
          controller.close();
          return;
        }

        if (!finalText.trim() || finalText.trim().length < MIN_VALID_LENGTH) {
          console.error("Grounded search response suspiciously short, discarding:", JSON.stringify(finalText));
          if (!finalText) controller.enqueue(encoder.encode(emptyResultFallback));
          controller.close();
          return;
        }

        controller.close();

        if (onSuccess) {
          try {
            const finalMessage = await stream.finalMessage();
            await onSuccess(finalText, finalMessage);
          } catch (onSuccessErr) {
            console.error("Grounded search onSuccess hook failed (non-fatal):", onSuccessErr);
          }
        }
      } catch (err) {
        console.error("Grounded search generation failed:", err);
        controller.enqueue(encoder.encode(exceptionFallback));
        controller.close();
      }
    },
  });
}
