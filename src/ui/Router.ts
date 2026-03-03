/** Simple hash-based router */
export type RouteHandler = () => void;

export class Router {
  private routes: Map<string, RouteHandler> = new Map();
  private defaultRoute: RouteHandler | null = null;

  /** Register a route handler */
  on(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  /** Set default route (fallback) */
  setDefault(handler: RouteHandler): void {
    this.defaultRoute = handler;
  }

  /** Start listening for hash changes */
  start(): void {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  /** Navigate to a hash route */
  navigate(path: string): void {
    window.location.hash = path;
  }

  /** Get current route path */
  getCurrentPath(): string {
    return window.location.hash.slice(1) || '/';
  }

  /** Resolve the current route */
  private handleRoute(): void {
    const path = this.getCurrentPath();
    const handler = this.routes.get(path);

    if (handler) {
      handler();
    } else if (this.defaultRoute) {
      this.defaultRoute();
    }
  }
}
