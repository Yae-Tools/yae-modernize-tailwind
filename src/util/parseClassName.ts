const parseClassName = (fullClass: string): { variants: string, className: string, original: string } => {
    const parts = fullClass.split(':');
    const className = parts.pop() || '';
    const variants = parts.join(':') + (parts.length > 0 ? ':' : '');
    return { variants, className, original: fullClass };
};

export default parseClassName;