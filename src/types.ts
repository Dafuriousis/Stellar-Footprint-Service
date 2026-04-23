export interface ResponseEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FootprintStats {
  readOnlyCount: number;
  readWriteCount: number;
  totalEntries: number;
  estimatedSizeBytes: number;
}

export interface AuthEntry {
  contractId: string;
  functionName: string;
  xdr: string;
}

export interface ContractEvent {
  type: string;
  contractId: string;
  topics: string[];
  data: string;
}

export interface ContractInvocation {
  contractId: string;
  functionName: string;
  args: string[];
}

export interface TtlInfo {
  liveUntilLedger: number;
  expiresInLedgers: number;
}
