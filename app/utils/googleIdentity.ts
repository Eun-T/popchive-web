interface Credential { credential?: string }
export interface GoogleIdentity {
  initialize(options: { client_id: string; nonce: string; ux_mode: 'popup'; auto_select: boolean; callback: (value: Credential) => void }): void
  renderButton(element: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; text: 'continue_with'; width: number; locale: string; click_listener: () => void }): void
}
let loading: Promise<GoogleIdentity> | undefined
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (!import.meta.client) return Promise.reject(new Error('Client only'))
  const sdk = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id
  if (sdk()) return Promise.resolve(sdk()!)
  if (loading) return loading
  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Google SDK unavailable')) }
    const timer = window.setTimeout(fail, 15000)
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { if (!sdk()) { fail(); return }; clearTimeout(timer); resolve(sdk()!) }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}
