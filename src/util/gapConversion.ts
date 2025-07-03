import { ConversionResult } from "../types/conversionTypes.js";
import parseClassName from "./parseClassName.js";

const gapConversion = (content: string): ConversionResult => {
    let changed = false;
    const newContent = content.replace(/class="([^"]*)"/g, (match, classString: string) => {
        const originalClasses = classString.split(' ').filter(c => c.length > 0);
        let newClassList = [...originalClasses];
        let modifiedInThisAttribute = false;

        const parsedClasses = originalClasses.map(parseClassName);

        // Check if there's any flex or grid class in the entire set of classes
        const overallHasFlexOrGrid = parsedClasses.some(p =>
            p.className === 'flex' || p.className === 'grid' ||
            p.className.startsWith('flex-') || p.className.startsWith('grid-')
        );

        if (!overallHasFlexOrGrid) {
            return match; // No flex or grid, so no gap conversion needed
        }

        const groupedByVariant: Record<string, { variants: string, className: string, original: string }[]> = parsedClasses.reduce((acc: Record<string, { variants: string, className: string, original: string }[]>, parsed) => {
            acc[parsed.variants] = acc[parsed.variants] || [];
            acc[parsed.variants].push(parsed);
            return acc;
        }, {});

        for (const variant in groupedByVariant) {
            const variantGroup = groupedByVariant[variant];

            const spaceXClassInfo = variantGroup.find(p => p.className.startsWith('space-x-'));
            const spaceYClassInfo = variantGroup.find(p => p.className.startsWith('space-y-'));

            if (spaceXClassInfo && spaceYClassInfo) {
                const spaceXValue = spaceXClassInfo.className.split('-').pop();
                const spaceYValue = spaceYClassInfo.className.split('-').pop();

                if (spaceXValue === spaceYValue) {
                    const newClass = `${variant}gap-${spaceXValue}`;
                    const index1 = newClassList.indexOf(spaceXClassInfo.original);
                    if (index1 > -1) newClassList.splice(index1, 1);
                    const index2 = newClassList.indexOf(spaceYClassInfo.original);
                    if (index2 > -1) newClassList.splice(index2, 1);
                    newClassList.push(newClass);
                    modifiedInThisAttribute = true;
                }
            }
        }

        if (modifiedInThisAttribute) {
            changed = true;
            return `class="${newClassList.join(' ')}"`;
        }

        return match;
    });

    return { newContent, changed };
};

export default gapConversion;