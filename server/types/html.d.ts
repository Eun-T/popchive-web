// Nitro bundles standalone HTML imports as strings.
declare module '*.html' {
  const html: string
  export default html
}
