import { diffWords } from "diff";

const CONTEXT = 10; // words of unchanged text to show on each side of a change

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

interface DiffViewProps {
  oldHtml: string;
  newHtml: string;
}

export default function DiffView({ oldHtml, newHtml }: DiffViewProps) {
  const chunks = diffWords(stripHtml(oldHtml), stripHtml(newHtml));
  const hasChanges = chunks.some((c) => c.added || c.removed);

  if (!hasChanges) {
    return (
      <p style={{ color: "#6b7280", fontSize: "0.75rem", fontStyle: "italic", margin: 0 }}>
        No text changes detected.
      </p>
    );
  }

  const nodes = chunks.map((chunk, i) => {
    if (chunk.added) {
      return (
        <mark
          key={i}
          style={{
            background: "#bbf7d0",
            color: "#14532d",
            borderRadius: "2px",
            padding: "0 1px",
          }}
        >
          {chunk.value}
        </mark>
      );
    }

    if (chunk.removed) {
      return (
        <span
          key={i}
          style={{
            background: "#fecaca",
            color: "#991b1b",
            textDecoration: "line-through",
            borderRadius: "2px",
            padding: "0 1px",
          }}
        >
          {chunk.value}
        </span>
      );
    }

    // Unchanged — collapse long runs, keeping context around each change
    const words = splitWords(chunk.value);
    const afterChange = i > 0 && (chunks[i - 1].added || chunks[i - 1].removed);
    const beforeChange =
      i < chunks.length - 1 && (chunks[i + 1].added || chunks[i + 1].removed);

    if (words.length <= CONTEXT * 2) {
      return <span key={i}>{chunk.value}</span>;
    }

    const ellipsis = (
      <span key={`${i}-e`} style={{ color: "#9ca3af" }}>
        {" "}…{" "}
      </span>
    );

    if (afterChange && beforeChange) {
      return (
        <span key={i}>
          {words.slice(0, CONTEXT).join(" ")}{ellipsis}{words.slice(-CONTEXT).join(" ")}{" "}
        </span>
      );
    }
    if (afterChange) {
      return (
        <span key={i}>
          {words.slice(0, CONTEXT).join(" ")}{ellipsis}
        </span>
      );
    }
    if (beforeChange) {
      return (
        <span key={i}>
          {ellipsis}{words.slice(-CONTEXT).join(" ")}{" "}
        </span>
      );
    }
    // Not adjacent to any change — full collapse
    return (
      <span key={i} style={{ color: "#9ca3af" }}>
        {" "}…{" "}
      </span>
    );
  });

  return (
    <div style={{ fontSize: "0.78rem", lineHeight: 1.7, wordBreak: "break-word" }}>
      {nodes}
    </div>
  );
}
