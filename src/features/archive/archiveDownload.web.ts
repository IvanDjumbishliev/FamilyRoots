export async function downloadArchiveFile(
  url: string,
  fileName: string,
  _mimeType: string,
) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Couldn’t download the archive file.');
  const href = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export async function openPdfPreview(url: string) {
  window.location.assign(url);
}
