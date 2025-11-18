const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface ApiResponse<T> {
  status: string;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          status: 'error',
          error: data.message || 'Request failed',
        };
      }

      return data;
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Jobs
  async createJob(jobData: {
    connector: string;
    source_platform: string;
    urls: string[];
    auth_mode?: string;
    depth?: number;
    max_items?: number;
    config?: Record<string, unknown>;
  }) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  async getJob(jobId: string) {
    return this.request(`/jobs/${jobId}`);
  }

  async listJobs(params?: {
    status?: string;
    connector?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();
    return this.request(`/jobs${query ? `?${query}` : ''}`);
  }

  async stopJob(jobId: string) {
    return this.request(`/jobs/${jobId}/stop`, {
      method: 'POST',
    });
  }

  // Items
  async listItems(params?: {
    crawl_id?: string;
    source_platform?: string;
    content_type?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();
    return this.request(`/items${query ? `?${query}` : ''}`);
  }

  async getItem(itemId: string) {
    return this.request(`/items/${itemId}`);
  }

  // Captcha
  async getCaptchaQueue() {
    return this.request('/captcha/queue');
  }

  async solveCaptcha(captchaId: string, solution: string, solvedBy: string) {
    return this.request(`/captcha/${captchaId}/solve`, {
      method: 'POST',
      body: JSON.stringify({
        solution_token: solution,
        solved_by: solvedBy,
      }),
    });
  }

  // Auth/Sessions
  async createSession(sessionData: {
    platform: string;
    account_identifier: string;
    credential_type?: string;
    cookie_bundle?: unknown;
    oauth_tokens?: unknown;
  }) {
    return this.request('/auth/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async listSessions(platform?: string) {
    const query = platform ? `?platform=${platform}` : '';
    return this.request(`/auth/sessions${query}`);
  }
}

export const apiClient = new ApiClient();
