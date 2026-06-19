/// <reference types="vite/client" />

declare module '*.mjml?raw' {
  const content: string;
  export default content;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}
