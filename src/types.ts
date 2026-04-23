export interface ResponseEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
