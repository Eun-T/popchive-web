export interface AppleAuthorization { id_token: string; code: string; state: string }
export interface AppleIdentity {
  init(config: { clientId: string; redirectURI: string; scope: 'email'; state: string; nonce: string; usePopup: true }): void
  signIn(): Promise<{ authorization: AppleAuthorization }>
}
let loading: Promise<AppleIdentity> | undefined
export function loadAppleIdentity(): Promise<AppleIdentity> {
  if (!import.meta.client) return Promise.reject(new Error('Client only'))
  const sdk = () => (window as Window & { AppleID?: { auth?: AppleIdentity } }).AppleID?.auth
  if (sdk()) return Promise.resolve(sdk()!)
  if (loading) return loading
  loading = new Promise<AppleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Apple SDK unavailable')) }
    const timer = window.setTimeout(fail, 15000)
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.async = true
    script.onload = () => { if (!sdk()) { fail(); return }; clearTimeout(timer); resolve(sdk()!) }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}
