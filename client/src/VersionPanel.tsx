import { VersionRead } from "./api";

interface VersionPanelProps {
  documentId: number;
  versions: VersionRead[];
  activeVersionId: number | null;
  onLoadPatent: (id: number) => void;
  onActivateVersion: (versionId: number) => void;
  onSave: () => void;
  onCreateVersion: () => void;
  isLoading: boolean;
}

export default function VersionPanel({
  documentId,
  versions,
  activeVersionId,
  onLoadPatent,
  onActivateVersion,
  onSave,
  onCreateVersion,
  isLoading,
}: VersionPanelProps) {
  return (
    <div className="flex flex-col gap-4 px-4 py-2 w-44 flex-shrink-0 border-r">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Patents
        </span>
        <button onClick={() => onLoadPatent(1)} disabled={isLoading}>
          Patent 1
        </button>
        <button onClick={() => onLoadPatent(2)} disabled={isLoading}>
          Patent 2
        </button>
      </div>

      {documentId > 0 && (
        <>
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Versions
            </span>
            <div className="flex flex-col gap-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onActivateVersion(v.id)}
                  disabled={isLoading}
                  style={{
                    textAlign: "left",
                    background: v.id === activeVersionId ? "#dbeafe" : undefined,
                    color: v.id === activeVersionId ? "#1e40af" : undefined,
                    fontWeight: v.id === activeVersionId ? 600 : undefined,
                    padding: "4px 8px",
                    borderRadius: "4px",
                  }}
                >
                  <span>v{v.version_number}</span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.7rem",
                      color: v.id === activeVersionId ? "#3b82f6" : "#9ca3af",
                    }}
                  >
                    {new Date(v.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <button onClick={onSave} disabled={isLoading}>
              Save
            </button>
            <button onClick={onCreateVersion} disabled={isLoading}>
              New Version
            </button>
          </div>
        </>
      )}
    </div>
  );
}
