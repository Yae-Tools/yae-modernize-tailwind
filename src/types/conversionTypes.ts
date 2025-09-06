export type ConversionResult = { newContent: string; changed: boolean };

export interface PatternMatcher {
  pattern: RegExp;
  framework: string[];
  syntax: 'quoted' | 'template' | 'binding' | 'multiline';
  extractor: (match: string) => string;
  reconstructor: (classes: string[], original: string) => string;
}

export interface ClassOperation {
  type: 'remove' | 'add' | 'replace';
  original?: string;
  replacement?: string;
  position?: number;
}

export interface ProcessingResult {
  success: boolean;
  error?: Error;
  changes?: number;
  operations?: ClassOperation[];
}

export interface ErrorContext {
  type: 'file' | 'content' | 'git' | 'config';
  code?: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ConversionContext {
  file: string;
  content: string;
  framework?: string;
  lineNumber?: number;
}

export interface SafeArrayResult {
  newClasses: string[];
  operations: ClassOperation[];
  changed: boolean;
}

export interface ClassInfo {
  className: string;
  variants: string;
  original: string;
  index: number;
}

// Error Logging Interfaces
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  totalMemory: number;
  freeMemory: number;
  cwd: string;
}

export interface GitStatus {
  isRepo: boolean;
  hasChanges: boolean;
  currentBranch?: string;
  lastCommit?: string;
}

export interface ErrorReportContext {
  sessionStartTime: Date;
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  gitStatus?: GitStatus;
  cliArguments: string[];
}

export interface ErrorReport {
  sessionId: string;
  timestamp: Date;
  error: ConversionError;
  systemInfo: SystemInfo;
  context: ErrorReportContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface LoggingConfig {
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxLogFiles: number;
  maxLogSizeBytes: number;
  logDirectory: string;
  enableMemoryBuffer: boolean;
  bufferSize: number;
}

export interface SessionSummary {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  filesProcessed: number;
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByFile: Record<string, number>;
  systemPerformance: {
    peakMemoryUsage: number;
    averageProcessingTime: number;
  };
  recommendations: string[];
}

export interface ConversionError {
  name: string;
  message: string;
  context: ErrorContext;
  recoverable: boolean;
  stack?: string;
}
