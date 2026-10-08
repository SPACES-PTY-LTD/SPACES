/** React Native emits upload progress but does not emit upload.load. */
export function observeDocumentUpload(xhr: XMLHttpRequest, onUploaded?: () => void) {
  let notified = false;
  const complete = () => {
    if (notified) return;
    notified = true;
    onUploaded?.();
  };
  xhr.upload.addEventListener('progress', event => {
    if (event.lengthComputable && event.total > 0 && event.loaded >= event.total) complete();
  });
  // Browser XHR supports this event; keep it alongside native progress.
  xhr.upload.addEventListener('load', complete);
  xhr.addEventListener('readystatechange', () => {
    // Receiving headers/body proves the server received the request. Do not
    // interpret DONE alone as success: network errors/timeouts also reach DONE.
    if (xhr.readyState === 2 || xhr.readyState === 3) complete();
  });
}
