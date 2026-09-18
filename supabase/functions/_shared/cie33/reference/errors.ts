export class ContractError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.details = details;
  }
}

export interface ValidationIssue {
  ruleId: string;
  code: string;
  message: string;
}
