import { type Lang } from './data.js';
export interface MountOptions {
    /** 'de' or 'en'. Default: data-lang of the element, then <html lang>, then 'de'. */
    lang?: Lang;
    /** URL of ctr-curves.json. Default: the file next to this module. */
    src?: string;
    /** ISO currency code for the funnel. Default: EUR. */
    currency?: string;
}
export interface Mounted {
    /** Removes the calculator and its window listener. */
    destroy(): void;
}
export declare function mount(root: HTMLElement, options?: MountOptions): Mounted;
