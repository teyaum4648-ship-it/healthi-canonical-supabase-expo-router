/** Bounded reads for edge requests/responses. No provider credentials or payloads are logged. */
export class BodyTooLargeError extends Error {
  constructor() { super('Body exceeds the supported size.'); this.name = 'BodyTooLargeError'; }
}

export async function readLimitedJson(message: Request | Response, maximumBytes: number): Promise<unknown> {
  const length = message.headers.get('content-length');
  if (length !== null && Number(length) > maximumBytes) throw new BodyTooLargeError();
  const reader = message.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        void reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
