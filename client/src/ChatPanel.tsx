import { DragEvent, useEffect, useRef, useState } from "react";

import DiffView from "./DiffView";

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  aiBaseContent: string | null;
  pendingAIContent: string | null;
  onSubmit: (instruction: string, file?: File) => void;
  onApplyChange: () => void;
  onDiscardChange: () => void;
}

export default function ChatPanel({
  messages,
  isLoading,
  aiBaseContent,
  pendingAIContent,
  onSubmit,
  onApplyChange,
  onDiscardChange,
}: ChatPanelProps) {
  const hasPendingChange = pendingAIContent !== null;
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, hasPendingChange]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || hasPendingChange) return;
    onSubmit(trimmed, attachedFile ?? undefined);
    setInput("");
    setAttachedFile(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropError(null);

    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith(".txt") || file.type === "text/plain") {
        setAttachedFile(file);
      } else {
        setDropError(`"${file.name}" is not a .txt file.`);
      }
      return;
    }

    // No file in the transfer — e.g. text selected and dragged from the document.
    const text = e.dataTransfer.getData("text/plain").trim();
    if (text) {
      setAttachedFile(new File([text], "dropped-text.txt", { type: "text/plain" }));
    } else {
      setDropError("Drop a .txt file or selected text.");
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Copy, not move — otherwise dragging a selection out of the TipTap editor
    // deletes it from the document.
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const messageBackground: Record<ChatMessage["role"], string> = {
    user: "#eff6ff",
    assistant: "#f9fafb",
    error: "#fef2f2",
  };

  const messageColor: Record<ChatMessage["role"], string> = {
    user: "#1e3a5f",
    assistant: "#374151",
    error: "#b91c1c",
  };

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 border-l px-4 py-2"
      style={{ width: "280px" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
    >
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        AI Editor
      </span>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pb-2">
        {messages.length === 0 && (
          <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontStyle: "italic" }}>
            Type an instruction to edit the document. Drag and drop a .txt file or selected text to
            provide extra context.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              background: messageBackground[msg.role],
              color: messageColor[msg.role],
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: "0.82rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
            }}
          >
            {msg.content}
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              background: "#f9fafb",
              color: "#6b7280",
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: "0.82rem",
            }}
          >
            Editing document...
          </div>
        )}

        {/* Pending change banner with inline diff */}
        {hasPendingChange && aiBaseContent && pendingAIContent && (
          <div
            style={{
              background: "#fefce8",
              border: "1px solid #fde047",
              borderRadius: "6px",
              padding: "10px",
              color: "#713f12",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "8px" }}>
              Proposed changes
            </div>
            <div
              style={{
                background: "white",
                border: "1px solid #fde047",
                borderRadius: "4px",
                padding: "8px",
                marginBottom: "10px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              <DiffView oldHtml={aiBaseContent} newHtml={pendingAIContent} />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={onApplyChange}
                style={{
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
              <button
                onClick={onDiscardChange}
                style={{
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Drag-over indicator */}
      {isDragOver && (
        <div
          style={{
            border: "2px dashed #60a5fa",
            borderRadius: "6px",
            padding: "10px",
            textAlign: "center",
            fontSize: "0.8rem",
            color: "#3b82f6",
            marginBottom: "6px",
          }}
        >
          Drop .txt file or selected text here
        </div>
      )}

      {/* Drop rejection feedback */}
      {dropError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#fef2f2",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "0.78rem",
            color: "#b91c1c",
            marginBottom: "6px",
          }}
        >
          <span style={{ flex: 1 }}>{dropError}</span>
          <button
            onClick={() => setDropError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#b91c1c",
              fontWeight: "bold",
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Attached file chip */}
      {attachedFile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#eff6ff",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "0.78rem",
            color: "#1d4ed8",
            marginBottom: "6px",
          }}
        >
          <span
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
          >
            {attachedFile.name}
          </span>
          <button
            onClick={() => setAttachedFile(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#60a5fa",
              fontWeight: "bold",
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input row — disabled while a change is pending */}
      <div style={{ display: "flex", gap: "6px", paddingBottom: "8px" }}>
        <textarea
          style={{
            flex: 1,
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            padding: "6px 8px",
            fontSize: "0.82rem",
            resize: "none",
            fontFamily: "inherit",
            opacity: hasPendingChange ? 0.5 : 1,
          }}
          rows={2}
          placeholder={
            hasPendingChange
              ? "Apply or discard the pending change first"
              : "Enter editing instruction..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isLoading || hasPendingChange}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || hasPendingChange || !input.trim()}
          style={{ alignSelf: "flex-end" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
