import { useEffect, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import useSWR from "swr";

import { APIError, api } from "./api";
import ChatPanel, { ChatMessage } from "./ChatPanel";
import Document from "./Document";
import LoadingOverlay from "./LoadingOverlay";
import VersionPanel from "./VersionPanel";
import Logo from "./assets/logo.png";

// useSWR to cache get patent document versions
const swrOptions = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
};

// All AI chat state for one (document, version) pair. Keeping these together
// lets each version of each document carry its own independent chat, pending
// edit, and diff base.
interface ChatSession {
  messages: ChatMessage[];
  pendingAIContent: string | null;
  aiBaseContent: string | null;
}

const EMPTY_SESSION: ChatSession = { messages: [], pendingAIContent: null, aiBaseContent: null };

function App() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number>(1);
  // Chat sessions keyed by "documentId:versionId"
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  // Session keys with an AI request currently processing
  const [aiLoadingKeys, setAILoadingKeys] = useState<ReadonlySet<string>>(new Set());
  const [editorModified, setEditorModified] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    onUpdate: () => setEditorModified(true),
  });

  const {
    data: docData,
    error: docError,
    isLoading: isDocLoading,
    mutate: mutateDocument,
  } = useSWR(["document", currentDocumentId], ([, id]) => api.getDocument(id), swrOptions);

  const {
    data: versions,
    error: versionsError,
    isLoading: isVersionsLoading,
    mutate: mutateVersions,
  } = useSWR(["versions", currentDocumentId], ([, id]) => api.getAllVersions(id), swrOptions);

  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const isLoading = isDocLoading || isVersionsLoading || isMutating;

  const sessionKey = `${currentDocumentId}:${activeVersionId ?? "loading"}`;
  const session = sessions[sessionKey] ?? EMPTY_SESSION;
  const isAILoading = aiLoadingKeys.has(sessionKey);

  const updateSession = (key: string, updater: (prev: ChatSession) => ChatSession) => {
    setSessions((prev) => ({ ...prev, [key]: updater(prev[key] ?? EMPTY_SESSION) }));
  };

  const documentIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (editor && docData && documentIdRef.current !== currentDocumentId) {
      documentIdRef.current = currentDocumentId;
      editor.commands.setContent(docData.content);
      setActiveVersionId(docData.version_id);
      setEditorModified(false);
    }
  }, [editor, docData, currentDocumentId]);

  useEffect(() => {
    const err = docError ?? versionsError;
    if (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to load document.");
    }
  }, [docError, versionsError]);

  const loadPatent = (documentId: number) => {
    if (documentId === currentDocumentId) return;
    setCurrentDocumentId(documentId);
  };

  const savePatent = async () => {
    if (!editor || activeVersionId === null) return;
    const content = editor.getHTML();
    setIsMutating(true);
    try {
      await api.saveVersion(currentDocumentId, activeVersionId, content);
      mutateDocument(
        (prev) => (prev && prev.version_id === activeVersionId ? { ...prev, content } : prev),
        { revalidate: false },
      );
      setEditorModified(false);
    } catch (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to save.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!editor) return;
    const content = editor.getHTML();
    setIsMutating(true);
    try {
      const newVersion = await api.createVersion(currentDocumentId, content);
      mutateVersions((prev) => [...(prev ?? []), newVersion], { revalidate: false });
      mutateDocument(
        (prev) => prev && { ...prev, content, version_id: newVersion.id },
        { revalidate: false },
      );
      setActiveVersionId(newVersion.id);
      setEditorModified(false);
    } catch (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to create version.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleSelectVersion = async (versionId: number) => {
    if (!editor || versionId === activeVersionId) return;
    setIsMutating(true);
    try {
      const version = await api.getVersion(currentDocumentId, versionId);
      editor.commands.setContent(version.content);
      setActiveVersionId(versionId);
      setEditorModified(false);
    } catch (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to switch version.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleAIEdit = async (instruction: string, file?: File) => {
    if (!editor || activeVersionId === null) return;
    const key = sessionKey;
    const baseContent = editor.getHTML();

    const userMessages: ChatMessage[] = [{ role: "user", content: instruction }];
    if (file) {
      userMessages.push({ role: "user", content: `[File: ${file.name}]` });
    }
    updateSession(key, (s) => ({
      ...s,
      aiBaseContent: baseContent,
      messages: [...s.messages, ...userMessages],
    }));
    setAILoadingKeys((prev) => new Set(prev).add(key));

    try {
      const contextFileContent = file ? await file.text() : undefined;
      const result = await api.aiEdit(
        currentDocumentId,
        baseContent,
        instruction,
        contextFileContent,
      );
      // Store as pending — don't apply to the editor until the user confirms.
      const readyMessage: ChatMessage = {
        role: "assistant",
        content: "Edit ready. Review and click Apply to update the document, or Discard to cancel.",
      };
      updateSession(key, (s) => ({
        ...s,
        pendingAIContent: result.updated_html,
        messages: [...s.messages, readyMessage],
      }));
    } catch (err) {
      const errorChat: ChatMessage = {
        role: "error",
        content: err instanceof APIError ? err.message : "AI edit failed.",
      };
      updateSession(key, (s) => ({
        ...s,
        aiBaseContent: null,
        messages: [...s.messages, errorChat],
      }));
    } finally {
      setAILoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleApplyAIChange = () => {
    if (!editor || !session.pendingAIContent) return;
    editor.commands.setContent(session.pendingAIContent);
    setEditorModified(true);
    updateSession(sessionKey, (s) => ({
      ...s,
      pendingAIContent: null,
      aiBaseContent: null,
      messages: [...s.messages, { role: "assistant", content: "Applied." } as ChatMessage],
    }));
  };

  const handleDiscardAIChange = () => {
    updateSession(sessionKey, (s) => ({
      ...s,
      pendingAIContent: null,
      aiBaseContent: null,
      messages: [...s.messages, { role: "assistant", content: "Discarded." } as ChatMessage],
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%" }}>
      {isLoading && <LoadingOverlay />}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          background: "black",
          height: "80px",
          flexShrink: 0,
          marginBottom: "30px",
        }}
      >
        <img src={Logo} alt="Logo" style={{ height: "50px" }} />
      </header>

      {errorMessage && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "8px 16px",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          width: "100%",
          background: "white",
        }}
      >
        <VersionPanel
          documentId={currentDocumentId}
          versions={versions ?? []}
          activeVersionId={activeVersionId}
          onLoadPatent={loadPatent}
          onSelectVersion={handleSelectVersion}
          onSave={savePatent}
          onCreateVersion={handleCreateVersion}
          isLoading={isLoading}
          editorModified={editorModified}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
          }}
        >
          <h2
            style={{
              alignSelf: "flex-start",
              color: "#213547",
              opacity: 0.6,
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {currentDocumentId > 0 ? `Patent ${currentDocumentId}` : ""}
          </h2>
          <Document editor={editor} />
        </div>

        <ChatPanel
          messages={session.messages}
          isLoading={isAILoading}
          aiBaseContent={session.aiBaseContent}
          pendingAIContent={session.pendingAIContent}
          onSubmit={handleAIEdit}
          onApplyChange={handleApplyAIChange}
          onDiscardChange={handleDiscardAIChange}
        />
      </div>
    </div>
  );
}

export default App;
