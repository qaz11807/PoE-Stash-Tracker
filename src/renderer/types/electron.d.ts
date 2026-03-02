export {};

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      openExternalLink: (url: string) => Promise<void>;
      db: {
        query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
        run: (sql: string, params?: unknown[]) => Promise<unknown>;
      };
    };
  }
}
