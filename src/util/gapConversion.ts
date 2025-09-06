import { ConversionResult } from '../types/conversionTypes.js';
import parseClassName from './parseClassName.js';
import { extractAllClassMatches, applyClassReplacements } from './patternRegistry.js';
import { ClassUtils } from './safeArrayOperations.js';
import { ErrorHandler } from './errorHandler.js';

const gapConversion = (content: string, filePath = 'unknown'): ConversionResult => {
  try {
    let changed = false;
    const classMatches = extractAllClassMatches(content, filePath);
    const replacements: { original: (typeof classMatches)[0]; newClasses: string[] }[] = [];

    for (const match of classMatches) {
      const originalClasses = match.classes.split(' ').filter((c) => c.length > 0);
      const parsedClasses = originalClasses.map((cls, index) => ({
        ...parseClassName(cls),
        index,
      }));

      // Check if there's any flex or grid class in the entire set of classes
      const overallHasFlexOrGrid = parsedClasses.some(
        (p) =>
          p.className === 'flex' ||
          p.className === 'grid' ||
          p.className.startsWith('flex-') ||
          p.className.startsWith('grid-'),
      );

      if (!overallHasFlexOrGrid) {
        continue; // No flex or grid, so no gap conversion needed
      }

      const processor = ClassUtils.createProcessor(match.classes);
      const groupedByVariant = ClassUtils.groupByVariant(parsedClasses);
      let matchModified = false;

      for (const variant in groupedByVariant) {
        const variantGroup = groupedByVariant[variant];

        const spaceXClasses = ClassUtils.findClassesWithPrefix(variantGroup, 'space-x');
        const spaceYClasses = ClassUtils.findClassesWithPrefix(variantGroup, 'space-y');

        // Find matching space-x- and space-y- classes with same values
        for (const spaceXClass of spaceXClasses) {
          for (const spaceYClass of spaceYClasses) {
            if (ClassUtils.haveSameValue(spaceXClass.className, spaceYClass.className)) {
              const value = ClassUtils.extractValue(spaceXClass.className);
              if (value) {
                const newClass = `${variant}gap-${value}`;

                // Use safe operations to replace the pair
                if (
                  ClassUtils.replacePair(
                    processor,
                    spaceXClass.original,
                    spaceYClass.original,
                    newClass,
                  )
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

export default gapConversion;
