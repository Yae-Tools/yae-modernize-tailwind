import { ConversionResult } from '../types/conversionTypes.js';
import parseClassName from './parseClassName.js';
import { extractAllClassMatches, applyClassReplacements } from './patternRegistry.js';
import { ClassUtils } from './safeArrayOperations.js';
import { ErrorHandler } from './errorHandler.js';

const createAxisConversion =
  (prefix: string) =>
  (content: string, filePath = 'unknown'): ConversionResult => {
    try {
      let changed = false;
      const classMatches = extractAllClassMatches(content, filePath);
      const replacements: { original: (typeof classMatches)[0]; newClasses: string[] }[] = [];

      for (const match of classMatches) {
        const processor = ClassUtils.createProcessor(match.classes);
        const originalClasses = match.classes.split(' ').filter((c) => c.length > 0);
        const parsedClasses = originalClasses.map((cls, index) => ({
          ...parseClassName(cls),
          index,
        }));

        const groupedByVariant = ClassUtils.groupByVariant(parsedClasses);
        let matchModified = false;

        for (const variant in groupedByVariant) {
          const variantGroup = groupedByVariant[variant];

          const xClasses = ClassUtils.findClassesWithPrefix(variantGroup, `${prefix}x`);
          const yClasses = ClassUtils.findClassesWithPrefix(variantGroup, `${prefix}y`);

          // Find matching x- and y- classes with same values
          for (const xClass of xClasses) {
            for (const yClass of yClasses) {
              if (ClassUtils.haveSameValue(xClass.className, yClass.className)) {
                const value = ClassUtils.extractValue(xClass.className);
                if (value) {
                  const newClass = `${variant}${prefix}-${value}`;

                  // Use safe operations to replace the pair
                  if (
                    ClassUtils.replacePair(processor, xClass.original, yClass.original, newClass)
                  ) {
                    matchModified = true;
                  }
                }
              }
            }
          }
        }

        if (matchModified) {
          const result = processor.execute();
          if (result.changed) {
            replacements.push({ original: match, newClasses: result.newClasses });
            changed = true;
          }
        }
      }

      const newContent =
        replacements.length > 0 ? applyClassReplacements(content, replacements) : content;

      return { newContent, changed };
    } catch (error) {
      const conversionError = ErrorHandler.handleContentError(error, filePath);
      ErrorHandler.recordError(conversionError);

      if (!ErrorHandler.shouldContinueProcessing(conversionError)) {
        throw conversionError;
      }

      // Return original content on error
      return { newContent: content, changed: false };
    }
  };

export default createAxisConversion;
