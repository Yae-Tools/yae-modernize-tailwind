import { ConversionResult } from "../types/conversionTypes.js";
import parseClassName from "./parseClassName.js";

const colorOpacityConversion = (content: string): ConversionResult => {
    let changed = false;
    const colorPrefixes = ['bg', 'text', 'border', 'ring', 'divide', 'placeholder'];

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

            for (const prefix of colorPrefixes) {
                const colorClassInfo = variantGroup.find(p => p.className.startsWith(`${prefix}-`) && !p.className.startsWith(`${prefix}-opacity-`) && !p.className.includes('/'));
                const opacityClassInfo = variantGroup.find(p => p.className.startsWith(`${prefix}-opacity-`));

                if (colorClassInfo && opacityClassInfo) {
                    const opacityValue = opacityClassInfo.className.split('-').pop();
                    if (opacityValue) {
                        const newClass = `${variant}${colorClassInfo.className}/${opacityValue}`;
                        
                        const index1 = newClassList.indexOf(colorClassInfo.original);
                        if (index1 > -1) newClassList.splice(index1, 1);
                        
                        const index2 = newClassList.indexOf(opacityClassInfo.original);
                        if (index2 > -1) newClassList.splice(index2, 1);
                        
                        newClassList.push(newClass);
                        modifiedInThisAttribute = true;
                    }
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

export default colorOpacityConversion;