// Minimal typ-stub för xlsx (SheetJS) — ersätts av de riktiga typerna efter npm install
declare module 'xlsx' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any
  export = content
}
