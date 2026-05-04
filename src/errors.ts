/** Thrown when the JSON data fails schema validation */
export class DataValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly invalidValue: unknown,
  ) {
    super(message)
    this.name = 'DataValidationError'
  }
}

/** Thrown when the network request to load data fails */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly url: string,
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}
