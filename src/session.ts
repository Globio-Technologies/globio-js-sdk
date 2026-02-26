import { GlobioSession } from './types';

const SESSION_KEY = 'globio_session';

export class SessionManager {
  private session: GlobioSession | null = null;
  private storage: 'localStorage' | 'memory';

  constructor(storage: 'localStorage' | 'memory' = 'memory') {
    this.storage = storage;
    this.session = this.load();
  }

  get(): GlobioSession | null {
    return this.session;
  }

  set(session: GlobioSession): void {
    this.session = session;
    if (this.storage === 'localStorage' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
      }
    }
  }

  clear(): void {
    this.session = null;
    if (this.storage === 'localStorage' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
      }
    }
  }

  isExpired(): boolean {
    if (!this.session) return true;
    return Date.now() / 1000 > this.session.expires_at - 60;
  }

  private load(): GlobioSession | null {
    if (this.storage === 'localStorage' && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
