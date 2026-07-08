import { Fragment } from "react";

// Coach and Roleplay replies are plain-text chat bubbles (no markdown
// renderer in the dependency tree), but the model still writes **bold**
// for emphasis — without this, those asterisks show up literally in the
// UI instead of rendering as bold. Deliberately minimal: only handles
// **bold**, since that's the one markdown construct actually showing up
// unrendered in practice, not a general-purpose markdown parser.
export function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
