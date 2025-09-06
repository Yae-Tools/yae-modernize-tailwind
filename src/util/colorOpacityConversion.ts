import { ConversionResult } from '../types/conversionTypes.js';
import parseClassName from './parseClassName.js';
import { extractAllClassMatches, applyClassReplacements } from './patternRegistry.js';
import { ClassUtils } from './safeArrayOperations.js';
import { ErrorHandler } from './errorHandler.js';

const colorOpacityConversion = (content: string, filePath = 'unknown'): ConversionResult => {
  try {
    let changed = false;
    const colorPrefixes = ['bg', 'text', 'border', 'ring', 'divide', 'placeholder'];
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

        for (const prefix of colorPrefixes) {
          const colorClasses = variantGroup.filter(
            (p) =>
              p.className.startsWith(`${prefix}-`) &&
              !p.className.startsWith(`${prefix}-opacity-`) &&
              !p.className.includes('/'),
          );
          const opacityClasses = variantGroup.filter((p) =>
            p.className.startsWith(`${prefix}-opacity-`),
          );

          // Find matching color and opacity classes
          for (const colorClass of colorClasses) {
            for (const opacityClass of opacityClasses) {
              const opacityValue = ClassUtils.extractValue(opacityClass.className);
              if (opacityValue) {
                const newClass = `${variant}${colorClass.className}/${opacityValue}`;

                // Use safe operations to replace the pair
                if (
                  ClassUtils.replacePair(
                    processor,
                    colorClass.original,
                    opacityClass.original,
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

export default colorOpacityConversion;
