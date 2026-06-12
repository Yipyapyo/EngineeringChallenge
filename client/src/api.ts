import axios, { AxiosError } from "axios";

const BASE_URL = "http://localhost:8000";

export interface DocumentRead {
  id: number;
  content: string;
  current_version_id: number | null;
}

export interface VersionRead {
  id: number;
  document_id: number;
  version_number: number;
  created_at: string;
}

export interface VersionReadWithContent extends VersionRead {
  content: string;
}

export interface AIEditResponse {
  updated_html: string;
}

const http = axios.create({ baseURL: BASE_URL });

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError && err.response?.data?.detail) {
    return String(err.response.data.detail);
  }
  return fallback;
}

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function request<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new APIError(extractErrorMessage(err, fallback));
  }
}

export const api = {
  getDocument: (id: number): Promise<DocumentRead> =>
    request(() => http.get<DocumentRead>(`/document/${id}`).then((r) => r.data), "Failed to load document"),

  saveDocument: (id: number, content: string): Promise<void> =>
    request(() => http.post(`/save/${id}`, { content }).then(() => undefined), "Failed to save document"),

  getAllVersions: (documentId: number): Promise<VersionRead[]> =>
    request(
      () => http.get<VersionRead[]>(`/document/${documentId}/versions`).then((r) => r.data),
      "Failed to load versions",
    ),

  getVersion: (documentId: number, versionId: number): Promise<VersionReadWithContent> =>
    request(
      () =>
        http
          .get<VersionReadWithContent>(`/document/${documentId}/versions/${versionId}`)
          .then((r) => r.data),
      "Failed to load version",
    ),

  createVersion: (documentId: number, content: string): Promise<VersionReadWithContent> =>
    request(
      () =>
        http
          .post<VersionReadWithContent>(`/document/${documentId}/versions`, { content })
          .then((r) => r.data),
      "Failed to create version",
    ),

  activateVersion: (documentId: number, versionId: number): Promise<DocumentRead> =>
    request(
      () =>
        http
          .put<DocumentRead>(`/document/${documentId}/versions/${versionId}/activate`)
          .then((r) => r.data),
      "Failed to activate version",
    ),

  aiEdit: (
    documentId: number,
    documentHtml: string,
    instruction: string,
    contextFileContent?: string,
  ): Promise<AIEditResponse> =>
    request(
      () =>
        http
          .post<AIEditResponse>(`/document/${documentId}/ai-edit`, {
            document_html: documentHtml,
            instruction,
            context_file_content: contextFileContent ?? null,
          })
          .then((r) => r.data),
      "AI edit failed",
    ),
};
