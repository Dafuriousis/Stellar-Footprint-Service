/**
 * Custom application error with HTTP status code
 */
export class AppError extends Error {
  /**
   * Create a new AppError
   * @param message - Error message
   * @param statusCode - HTTP status code
   */
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
