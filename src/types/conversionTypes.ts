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
