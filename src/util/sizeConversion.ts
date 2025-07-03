import { ConversionResult } from "../types/conversionTypes.js";
import parseClassName from "./parseClassName.js";

const sizeConversion = (content: string): ConversionResult => {
    let changed = false;
    const newContent = content.replace(/(?:class|className)=\{?"([^"]*)"\}?/g, (match, classString: string) => {
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

            const wClassInfo = variantGroup.find(p => p.className.startsWith(`w-`));
            const hClassInfo = variantGroup.find(p => p.className.startsWith(`h-`));

            if (wClassInfo && hClassInfo) {
                const wValue = wClassInfo.className.split('-')[1];
                const hValue = hClassInfo.className.split('-')[1];

                if (wValue === hValue) {
                    const newClass = `${variant}size-${wValue}`;
                    const index1 = newClassList.indexOf(wClassInfo.original);
                    if (index1 > -1) newClassList.splice(index1, 1);
                    const index2 = newClassList.indexOf(hClassInfo.original);
                    if (index2 > -1) newClassList.splice(index2, 1);
                    newClassList.push(newClass);
                    modifiedInThisAttribute = true;
                }
            }
        }

        if (modifiedInThisAttribute) {
            changed = true;
            const attributeName = match.startsWith('className') ? 'className' : 'class';
            const hasCurlyBraces = match.includes('{');
            if (hasCurlyBraces) {
                return `${attributeName}={"${newClassList.join(' ')}"}`;
            } else {
                return `${attributeName}="${newClassList.join(' ')}"`;
            }
        }

        return match;
    });

    return { newContent, changed };
};

export default sizeConversion;