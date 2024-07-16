import { LRLanguage, LanguageSupport } from '@codemirror/language';

declare const mvelLanguage: LRLanguage;
declare function mvel(): LanguageSupport;

export { mvel, mvelLanguage };
