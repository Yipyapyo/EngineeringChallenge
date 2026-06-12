import os
import re

from dotenv import load_dotenv
from openai import APIError, APITimeoutError, AsyncOpenAI, RateLimitError

load_dotenv()

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert patent document editor. You receive an HTML patent document and a plain-text editing instruction. Apply the instruction precisely and return the complete, modified HTML document.

Rules:
1. Return ONLY the complete HTML document. Do not include markdown code fences, commentary, or any text outside the HTML.
2. Preserve all HTML structure, tags, and formatting that is not affected by the instruction.
3. Patent claim numbers must remain consistent. If you delete a numbered claim, renumber subsequent claims accordingly and update all dependency references (e.g. "claim 3" becomes "claim 2" if claim 2 was deleted).
4. If the instruction is ambiguous, apply the most conservative reasonable interpretation.
5. If context from an uploaded file is provided, use it to fulfill the instruction but do not include the raw file text in the output.
6. Never add claims or sections that were not explicitly requested."""

# Regex to strip down markdown code from the AI response
_FENCE_RE = re.compile(r"^```(?:html)?\s*\n?(.*?)\n?```\s*$", re.DOTALL)

MAX_CONTEXT_CHARS = 20_000


class AIServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


async def apply_edit_instruction(
    document_html: str,
    instruction: str,
    context_file_content: str | None = None,
) -> str:
    user_content = (
        f"Here is the current patent document HTML:\n\n{document_html}\n\n"
        f"Instruction: {instruction}"
    )
    if context_file_content:
        truncated = context_file_content[:MAX_CONTEXT_CHARS]
        user_content += f"\n\nAdditional context from uploaded file:\n{truncated}"

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            temperature=0,
            max_tokens=16384,
            timeout=60.0,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )
    except RateLimitError as e:
        raise AIServiceError(str(e), status_code=429) from e
    except APITimeoutError as e:
        raise AIServiceError("OpenAI request timed out", status_code=504) from e
    except APIError as e:
        raise AIServiceError(f"OpenAI API error: {e}", status_code=502) from e

    raw = response.choices[0].message.content or ""
    match = _FENCE_RE.match(raw.strip())
    if match:
        raw = match.group(1)

    if not raw.strip():
        raise AIServiceError("AI returned an empty response", status_code=502)

    return raw
