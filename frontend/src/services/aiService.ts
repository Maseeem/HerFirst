export interface AIIntegrationStatus {
  isConfigured: boolean;
  provider: string;
  endpoint?: string;
  model?: string;
  status: 'missing_credentials' | 'backend_unreachable' | 'configured' | 'active' | 'error';
  diagnosticMessage: string;
}

export class AIService {
  private static backendUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'http://localhost:8000';

  /**
   * Inspects and tests the existing backend and AMD Token Factory integration.
   * Reports status honestly without fabricating success.
   */
  public static async inspectIntegration(): Promise<AIIntegrationStatus> {
    try {
      // Attempt to ping the backend health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${this.backendUrl}/api/health`, {
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (!response || !response.ok) {
        return {
          isConfigured: false,
          provider: 'AMD Token Factory',
          endpoint: this.backendUrl,
          status: 'backend_unreachable',
          diagnosticMessage:
            'Backend API server is currently offline or unreachable at http://localhost:8000. AMD Token Factory credentials remain unconfigured on backend. Using domain-aware fallback generator.',
        };
      }

      const data = await response.json();
      if (!data.amd_configured) {
        return {
          isConfigured: false,
          provider: 'AMD Token Factory',
          endpoint: this.backendUrl,
          status: 'missing_credentials',
          diagnosticMessage:
            'FastAPI backend is reachable, but AMD Token Factory settings are incomplete. The app remains usable with its offline domain-aware fallback.',
        };
      }

      return {
        isConfigured: true,
        provider: 'AMD Token Factory',
        endpoint: this.backendUrl,
        model: data.model || undefined,
        status: 'configured',
        diagnosticMessage:
          'AMD settings are present on the backend. A real blueprint or guidance request is still needed to verify that the selected model endpoint responds.',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        isConfigured: false,
        provider: 'AMD Token Factory',
        endpoint: this.backendUrl,
        status: 'error',
        diagnosticMessage: `Error connecting to backend AI provider: ${errorMsg}. Using domain-aware guidance synthesizer.`,
      };
    }
  }
}
