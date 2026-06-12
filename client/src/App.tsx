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

// useSWR to cache patent document versions
const swrOptions = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
};

function App() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number>(1);
  const [chatMessagesByDoc, setChatMessagesByDoc] = useState<Record<number, ChatMessage[]>>({});
  const chatMessages = chatMessagesByDoc[currentDocumentId] ?? [];

  const setChatMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setChatMessagesByDoc((prev) => {
      const current = prev[currentDocumentId] ?? [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [currentDocumentId]: next };
    });
  };

  const [pendingAIContent, setPendingAIContent] = useState<string | null>(null);
  const [aiBaseContent, setAIBaseContent] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editor = useEditor({ extensions: [StarterKit] });

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

  const activeVersionId = docData?.current_version_id ?? null;
  const isLoading = isDocLoading || isVersionsLoading || isMutating;

  const documentIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (editor && docData && documentIdRef.current !== currentDocumentId) {
      documentIdRef.current = currentDocumentId;
      editor.commands.setContent(docData.content);
      setPendingAIContent(null);
      setAIBaseContent(null);
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
    if (!editor) return;
    const content = editor.getHTML();
    setIsMutating(true);
    try {
      await api.saveDocument(currentDocumentId, content);
      mutateDocument((prev) => prev && { ...prev, content }, { revalidate: false });
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
        (prev) => prev && { ...prev, content, current_version_id: newVersion.id },
        { revalidate: false },
      );
    } catch (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to create version.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleActivateVersion = async (versionId: number) => {
    if (!editor || versionId === activeVersionId) return;
    setIsMutating(true);
    try {
      const updatedDoc = await api.activateVersion(currentDocumentId, versionId);
      mutateDocument(updatedDoc, { revalidate: false });
      editor.commands.setContent(updatedDoc.content);
    } catch (err) {
      setErrorMessage(err instanceof APIError ? err.message : "Failed to switch version.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleAIEdit = async (instruction: string, file?: File) => {
    if (!editor) return;
    const baseContent = editor.getHTML();

    const userMessages: ChatMessage[] = [{ role: "user", content: instruction }];
    if (file) {
      userMessages.push({ role: "user", content: `[File: ${file.name}]` });
    }
    setChatMessages((prev) => [...prev, ...userMessages]);
    setAIBaseContent(baseContent);
    setIsAILoading(true);

    try {
      const contextFileContent = file ? await file.text() : undefined;
      const result = await api.aiEdit(
        currentDocumentId,
        baseContent,
        instruction,
        contextFileContent,
      );
      // Store as pending — don't apply to the editor until the user confirms.
      setPendingAIContent(result.updated_html);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Edit ready. Review and click Apply to update the document, or Discard to cancel.",
        },
      ]);
    } catch (err) {
      const message = err instanceof APIError ? err.message : "AI edit failed.";
      setChatMessages((prev) => [...prev, { role: "error", content: message }]);
      setAIBaseContent(null);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleApplyAIChange = () => {
    if (!editor || !pendingAIContent) return;
    editor.commands.setContent(pendingAIContent);
    setPendingAIContent(null);
    setAIBaseContent(null);
    setChatMessages((prev) => [...prev, { role: "assistant", content: "Applied." }]);
  };

  const handleDiscardAIChange = () => {
    setPendingAIContent(null);
    setAIBaseContent(null);
    setChatMessages((prev) => [...prev, { role: "assistant", content: "Discarded." }]);
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
          onActivateVersion={handleActivateVersion}
          onSave={savePatent}
          onCreateVersion={handleCreateVersion}
          isLoading={isLoading}
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
          messages={chatMessages}
          isLoading={isAILoading}
          aiBaseContent={aiBaseContent}
          pendingAIContent={pendingAIContent}
          onSubmit={handleAIEdit}
          onApplyChange={handleApplyAIChange}
          onDiscardChange={handleDiscardAIChange}
        />
      </div>
    </div>
  );
}

export default App;
