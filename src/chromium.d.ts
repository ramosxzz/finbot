declare module '@sparticuz/chromium' {
  const chromium: {
    executablePath(): Promise<string>;
    args: string[];
    headless: boolean;
  };
  export default chromium;
}