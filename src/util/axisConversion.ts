import { ConversionResult } from "../types/conversionTypes.js";
import parseClassName from "./parseClassName.js";

const createAxisConversion = (prefix: string) => (content: string): ConversionResult => {
    let changed = false;
    const newContent = content.replace(/class="([^"]*)"/g, (match, classString: string) => {
        const originalClasses = classString.split(' ').filter(c => c.length > 0);
        let newClassList = [...originalClasses];
        let modifiedInThisAttribute = false;

        const parsedClasses = originalClasses.map(parseClassName);

        const groupedByVariant: Record<string, { variants: string, className: string, original: string }[]> = parsedClasses.reduce((acc: Record<string, { variants: string, className: string, original: string }[]>, parsed) => {
            acc[parsed.variants] = acc[parsed.variants] || [];
            acc[parsed.variants].push(parsed);
            return acc;
        }, {});

        for (const variant in groupedByVariant) {
            const variantGroup = groupedByVariant[variant];

            const xClassInfo = variantGroup.find(p => p.className.startsWith(`${prefix}x-`));
            const yClassInfo = variantGroup.find(p => p.className.startsWith(`${prefix}y-`));

            if (xClassInfo && yClassInfo) {
                const xValue = xClassInfo.className.split('-')[1];
                const yValue = yClassInfo.className.split('-')[1];

                if (xValue === yValue) {
                    const newClass = `${variant}${prefix}-${xValue}`;
                    const index1 = newClassList.indexOf(xClassInfo.original);
                    if (index1 > -1) newClassList.splice(index1, 1);
                    const index2 = newClassList.indexOf(yClassInfo.original);
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
}

export default createAxisConversion;