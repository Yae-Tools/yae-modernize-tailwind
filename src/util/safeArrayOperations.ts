import { ClassOperation, SafeArrayResult, ClassInfo } from '../types/conversionTypes.js';

/**
 * Interface for marking class operations
 */
interface ClassMark {
  index: number;
  operation: 'remove' | 'replace';
  original: string;
  replacement?: string;
}

/**
 * Safe array processor that uses marking strategy to avoid index-shifting issues
 */
export class SafeClassProcessor {
  private originalClasses: string[];
  private marks: ClassMark[] = [];
  private additions: string[] = [];

  constructor(classes: string[]) {
    this.originalClasses = [...classes];
  }

  /**
   * Mark a class for removal
   */
  markForRemoval(className: string): boolean {
    const index = this.originalClasses.indexOf(className);
    if (index === -1) return false;

    this.marks.push({
      index,
      operation: 'remove',
      original: className,
    });

    return true;
  }

  /**
   * Mark multiple classes for removal
   */
  markMultipleForRemoval(classNames: string[]): number {
    let removed = 0;
    for (const className of classNames) {
      if (this.markForRemoval(className)) {
        removed++;
      }
    }
    return removed;
  }

  /**
   * Mark a class for replacement
   */
  markForReplacement(original: string, replacement: string): boolean {
    const index = this.originalClasses.indexOf(original);
    if (index === -1) return false;

    this.marks.push({
      index,
      operation: 'replace',
      original,
      replacement,
    });

    return true;
  }

  /**
   * Add new classes (will be appended at the end)
   */
  addClasses(classNames: string[]): void {
    this.additions.push(...classNames);
  }

  /**
   * Add a single class
   */
  addClass(className: string): void {
    this.additions.push(className);
  }

  /**
   * Execute all marked operations and return the result
   */
  execute(): SafeArrayResult {
    const operations: ClassOperation[] = [];
    const processedIndices = new Set<number>();
    const result: string[] = [];

    // Process original classes, applying marks
    for (let i = 0; i < this.originalClasses.length; i++) {
      const className = this.originalClasses[i];
      const mark = this.marks.find((m) => m.index === i);

      if (mark) {
        processedIndices.add(i);

        if (mark.operation === 'remove') {
          operations.push({
            type: 'remove',
            original: mark.original,
          });
          // Class is removed, don't add to result
        } else if (mark.operation === 'replace' && mark.replacement) {
          operations.push({
            type: 'replace',
            original: mark.original,
            replacement: mark.replacement,
          });
          result.push(mark.replacement);
        }
      } else {
        // No mark, keep the original class
        result.push(className);
      }
    }

    // Add new classes
    for (const addition of this.additions) {
      result.push(addition);
      operations.push({
        type: 'add',
        replacement: addition,
      });
    }

    const changed = this.marks.length > 0 || this.additions.length > 0;

    return {
      newClasses: result,
      operations,
      changed,
    };
  }

  /**
   * Get current state without executing (for debugging)
   */
  preview(): {
    original: string[];
    marks: ClassMark[];
    additions: string[];
  } {
    return {
      original: [...this.originalClasses],
      marks: [...this.marks],
      additions: [...this.additions],
    };
  }

  /**
   * Clear all marks and additions
   */
  reset(): void {
    this.marks = [];
    this.additions = [];
  }
}

/**
 * Utility functions for common class operations
 */
export class ClassUtils {
  /**
   * Safely replace pairs of classes (e.g., w-4 h-4 -> size-4)
   */
  static replacePair(
    processor: SafeClassProcessor,
    class1: string,
    class2: string,
    replacement: string,
  ): boolean {
    const removed1 = processor.markForRemoval(class1);
    const removed2 = processor.markForRemoval(class2);

    if (removed1 && removed2) {
      processor.addClass(replacement);
      return true;
    }

    // If we couldn't remove both classes, reset the processor
    if (removed1 || removed2) {
      processor.reset();
    }

    return false;
  }

  /**
   * Safely replace a single class
   */
  static replaceSingle(
    processor: SafeClassProcessor,
    original: string,
    replacement: string,
  ): boolean {
    return processor.markForReplacement(original, replacement);
  }

  /**
   * Extract value from a Tailwind class (e.g., 'w-4' -> '4')
   */
  static extractValue(className: string): string | null {
    const parts = className.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }

  /**
   * Extract prefix from a Tailwind class (e.g., 'w-4' -> 'w')
   */
  static extractPrefix(className: string): string {
    const parts = className.split('-');
    return parts[0];
  }

  /**
   * Check if two classes have the same value (e.g., 'w-4' and 'h-4')
   */
  static haveSameValue(class1: string, class2: string): boolean {
    const value1 = this.extractValue(class1);
    const value2 = this.extractValue(class2);
    return value1 !== null && value1 === value2;
  }

  /**
   * Group classes by their variant prefix
   */
  static groupByVariant(classInfos: ClassInfo[]): Record<string, ClassInfo[]> {
    return classInfos.reduce(
      (acc, classInfo) => {
        const variant = classInfo.variants;
        if (!acc[variant]) {
          acc[variant] = [];
        }
        acc[variant].push(classInfo);
        return acc;
      },
      {} as Record<string, ClassInfo[]>,
    );
  }

  /**
   * Find classes with specific prefix in a group
   */
  static findClassesWithPrefix(classes: ClassInfo[], prefix: string): ClassInfo[] {
    return classes.filter((classInfo) => classInfo.className.startsWith(`${prefix}-`));
  }

  /**
   * Create a new processor from class string
   */
  static createProcessor(classString: string): SafeClassProcessor {
    const classes = classString.split(' ').filter((c) => c.length > 0);
    return new SafeClassProcessor(classes);
  }

  /**
   * Validate that all required classes exist before processing
   */
  static validateClassesExist(classes: string[], required: string[]): boolean {
    return required.every((req) => classes.includes(req));
  }

  /**
   * Remove duplicate classes while preserving order
   */
  static removeDuplicates(classes: string[]): string[] {
    const seen = new Set<string>();
    return classes.filter((className) => {
      if (seen.has(className)) {
        return false;
      }
      seen.add(className);
      return true;
    });
  }

  /**
   * Merge two class arrays safely
   */
  static mergeClasses(classes1: string[], classes2: string[]): string[] {
    const combined = [...classes1, ...classes2];
    return this.removeDuplicates(combined);
  }
}
