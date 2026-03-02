import { app, safeStorage, shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface League {
  id: string;
  realm?: string;
  description?: string;
  registerAt?: string;
  startAt?: string;
  endAt?: string;
}

interface StashItem {
  id: string;
  typeLine: string;
  name?: string;
  icon?: string;
  ilvl?: number;
  identified?: boolean;
  frameType?: number;
  stackSize?: number;
  note?: string;
  [key: string]: unknown;
}

interface StashTab {
  id: string;
  index: number;
  name: string;
  type?: string;
  color?: string;
  folder?: boolean;
}

interface TokenPayload {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope?: string;
  created_at: number;
  expires_in: number;
}

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt: number;
}

interface PendingAuth {
  state: string;
  verifier: string;
  resolve: (token: StoredToken) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const API_BASE = 'https://api.pathofexile.com';
const AUTHORIZE_URL = 'https://www.pathofexile.com/oauth/authorize';
const TOKEN_URL = 'https://www.pathofexile.com/oauth/token';
const REDIRECT_URI = process.env.POE_REDIRECT_URI ?? 'poestashtracker://oauth/callback';
const SCOPES = process.env.POE_SCOPES ?? 'account:stashes';

export class PoeApiClient {
  private readonly tokenFilePath = path.join(app.getPath('userData'), 'poe-token.enc');
  private pendingAuth?: PendingAuth;
  private pendingAuthRequest?: Promise<{ authenticated: boolean; expiresAt: number }>;

  async authenticate(): Promise<{ authenticated: boolean; expiresAt: number }> {
    const stored = await this.loadToken();
    if (stored && stored.expiresAt > Date.now() + 10_000) {
      return { authenticated: true, expiresAt: stored.expiresAt };
    }

    if (stored?.refreshToken) {
      try {
        const refreshed = await this.refreshAccessToken(stored.refreshToken);
        return { authenticated: true, expiresAt: refreshed.expiresAt };
      } catch {
        // Fallback to full OAuth if refresh fails.
      }
    }

    if (this.pendingAuthRequest) {
      return this.pendingAuthRequest;
    }

    const request = this.startAuthenticationFlow();
    this.pendingAuthRequest = request;
    try {
      return await request;
    } finally {
      if (this.pendingAuthRequest === request) {
        this.pendingAuthRequest = undefined;
      }
    }
  }

  async handleOAuthCallback(callbackUrl: string): Promise<boolean> {
    if (!this.pendingAuth) {
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(callbackUrl);
    } catch {
      return false;
    }

    const state = parsed.searchParams.get('state');
    const code = parsed.searchParams.get('code');
    const error = parsed.searchParams.get('error');

    if (state !== this.pendingAuth.state) {
      return false;
    }

    const auth = this.pendingAuth;
    this.pendingAuth = undefined;
    clearTimeout(auth.timeout);

    if (error) {
      auth.reject(new Error(`OAuth error: ${error}`));
      return true;
    }

    if (!code) {
      auth.reject(new Error('OAuth callback did not include code.'));
      return true;
    }

    try {
      const token = await this.exchangeCodeForToken(code, auth.verifier);
      await this.saveToken(token);
      auth.resolve(token);
    } catch (err) {
      auth.reject(err instanceof Error ? err : new Error(String(err)));
    }

    return true;
  }

  private async startAuthenticationFlow(): Promise<{ authenticated: boolean; expiresAt: number }> {
    const state = this.randomBase64Url(24);
    const verifier = this.randomBase64Url(64);
    const challenge = this.sha256Base64Url(verifier);

    const authorizationUrl = new URL(AUTHORIZE_URL);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', this.getClientId());
    authorizationUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authorizationUrl.searchParams.set('scope', SCOPES);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('code_challenge', challenge);

    const token = await new Promise<StoredToken>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAuth = undefined;
        reject(new Error('OAuth authentication timed out.'));
      }, 180_000);

      this.pendingAuth = { state, verifier, resolve, reject, timeout };

      shell
        .openExternal(authorizationUrl.toString())
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingAuth = undefined;
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });

    return { authenticated: true, expiresAt: token.expiresAt };
  }

  async getLeagues(): Promise<League[]> {
    const token = await this.getValidAccessToken();
    const url = new URL('/data/leagues', API_BASE);
    const response = await this.fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const body = (await response.json()) as { result?: unknown[] };
    const leagues = body.result ?? [];
    return leagues.map((league) => {
      const record = league as Record<string, unknown>;
      return {
        id: String(record.id ?? ''),
        realm: record.realm ? String(record.realm) : undefined,
        description: record.description ? String(record.description) : undefined,
        registerAt: record.registerAt ? String(record.registerAt) : undefined,
        startAt: record.startAt ? String(record.startAt) : undefined,
        endAt: record.endAt ? String(record.endAt) : undefined
      };
    });
  }

  async getStashTabs(leagueId: string): Promise<StashTab[]> {
    const token = await this.getValidAccessToken();
    const url = new URL(`/stash/${encodeURIComponent(leagueId)}`, API_BASE);
    url.searchParams.set('tabs', '1');

    const response = await this.fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const body = (await response.json()) as { stashes?: unknown[] };
    const stashes = body.stashes ?? [];

    return stashes.map((stash, index) => {
      const record = stash as Record<string, unknown>;
      const stashId = record.id != null ? String(record.id) : String(index);
      return {
        id: stashId,
        index,
        name: record.name ? String(record.name) : `Tab ${index + 1}`,
        type: record.type ? String(record.type) : undefined,
        color: record.color ? String(record.color) : undefined,
        folder: typeof record.folder === 'boolean' ? record.folder : undefined
      };
    });
  }

  async getStashTabContent(leagueId: string, stashId: string): Promise<StashItem[]> {
    const token = await this.getValidAccessToken();
    const url = new URL(`/stash/${encodeURIComponent(leagueId)}`, API_BASE);
    url.searchParams.set('tabs', stashId);

    const response = await this.fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const body = (await response.json()) as { stashes?: Array<{ items?: unknown[] }> };
    const items = body.stashes?.[0]?.items ?? [];
    return items as StashItem[];
  }

  private async exchangeCodeForToken(code: string, verifier: string): Promise<StoredToken> {
    const payload = {
      grant_type: 'authorization_code',
      client_id: this.getClientId(),
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    };

    const response = await this.fetchWithRetry(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json()) as TokenPayload;
    return this.toStoredToken(body);
  }

  private async refreshAccessToken(refreshToken: string): Promise<StoredToken> {
    const payload = {
      grant_type: 'refresh_token',
      client_id: this.getClientId(),
      refresh_token: refreshToken
    };

    const response = await this.fetchWithRetry(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json()) as TokenPayload;
    const token = this.toStoredToken(body);
    await this.saveToken(token);
    return token;
  }

  private toStoredToken(token: TokenPayload): StoredToken {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      scope: token.scope,
      expiresAt: (token.created_at * 1000) + (token.expires_in * 1000)
    };
  }

  private async getValidAccessToken(): Promise<string> {
    const stored = await this.loadToken();
    if (!stored) {
      throw new Error('PoE is not authenticated. Please run poe:authenticate first.');
    }

    if (stored.expiresAt > Date.now() + 10_000) {
      return stored.accessToken;
    }

    if (!stored.refreshToken) {
      throw new Error('PoE access token expired and no refresh token is available.');
    }

    const refreshed = await this.refreshAccessToken(stored.refreshToken);
    return refreshed.accessToken;
  }

  private async fetchWithRetry(url: string, init: RequestInit, maxRetries = 5): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch(url, init);

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
        const backoffMs = Math.max(retryAfterMs, 400 * (2 ** attempt));
        await this.sleep(backoffMs);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`PoE API request failed (${response.status}): ${text || response.statusText}`);
      }

      return response;
    }

    throw new Error('PoE API rate limit retries exhausted.');
  }

  private async saveToken(token: StoredToken): Promise<void> {
    const json = JSON.stringify(token);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      await fs.writeFile(this.tokenFilePath, encrypted);
      return;
    }

    await fs.writeFile(this.tokenFilePath, json, 'utf8');
  }

  private async loadToken(): Promise<StoredToken | null> {
    try {
      const data = await fs.readFile(this.tokenFilePath);
      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(data);
        return JSON.parse(decrypted) as StoredToken;
      }

      return JSON.parse(data.toString('utf8')) as StoredToken;
    } catch {
      return null;
    }
  }

  private randomBase64Url(size: number): string {
    return randomBytes(size).toString('base64url');
  }

  private getClientId(): string {
    const value = process.env.POE_CLIENT_ID;
    if (!value) {
      throw new Error('POE_CLIENT_ID 尚未設定，請在設定頁輸入 Client ID');
    }
    return value;
  }

  private sha256Base64Url(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
