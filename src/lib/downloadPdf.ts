/** Download a base64 / data-URI PDF reliably via Blob (works when <a download> fails). */
export function downloadPdfFromDataUri(dataUriOrBase64: string, filename: string): void {
  const raw = dataUriOrBase64.trim();
  const base64 = raw.includes("base64,") ? raw.split("base64,")[1]! : raw;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
