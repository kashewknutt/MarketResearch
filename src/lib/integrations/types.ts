export interface IntegrationStatus {
  name: string;
  configured: boolean;
  message: string;
}

export interface IntegrationSignal {
  source: string;
  title: string;
  snippet: string;
  url?: string;
}
