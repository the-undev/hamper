/** Whether the page has a secure context, which the service worker, install and the share sheet need. */
export function useSecureContext(): boolean {
  return window.isSecureContext;
}
