  export function extractDocumentId(url: string): string {
    const match = url.match(/\/wiki\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error(`Invalid document URL: ${url}`);
    }
    return match[1];
  }