/**
 * @typedef {Object} AreaProps
 * @property {DSArea} area
 * @property {PubSub} PS
 * @property {number} zoom
 */
export default class Area {
    /**
     * @constructor Area
     * @param {AreaProps} settings
     * @ignore
     */
    constructor({ area, PS, zoom }: AreaProps);
    /**
     * @type {DSModificationCallback}
     * @private
     */
    private _modificationCallback;
    /**
     * @type {MutationObserver}
     * @private
     */
    private _modificationObserver;
    /**
     * @type {number}
     * @private
     */
    private _zoom;
    /**
     * @type {DSArea}
     * @private
     */
    private _node;
    /**
     * @type {DSArea[]}
     * @private
     */
    private _parentNodes;
    /**
     * @type {CSSStyleDeclaration}
     * @private
     * */
    private _computedStyle;
    /**
     * @type {{top:number,bottom:number,left:number,right:number}}
     * @private
     * */
    private _computedBorder;
    /**
     * @type {DSBoundingRect}
     * @private
     * */
    private _rect;
    PubSub: PubSub;
    /** @param {DSArea} area */
    setArea: (area: DSArea) => void;
    start: () => void;
    reset: () => void;
    stop: () => void;
    /**
     * Scroll the area in the specified direction
     * @param {Array.<'top'|'bottom'|'left'|'right'|undefined>} directions
     * @param {number} multiplier
     */
    scroll: (directions: Array<'top' | 'bottom' | 'left' | 'right' | undefined>, multiplier: number) => void;
    get HTMLNode(): DSArea;
    /**
     * The computed border from the element (caches result)
     * @type {{top:number,bottom:number,left:number,right:number}}
     */
    get computedBorder(): {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    /**
     * The computed styles from the element (caches result)
     * @type {CSSStyleDeclaration}
     */
    get computedStyle(): CSSStyleDeclaration;
    /**
     * The element rect (caches result) (without scrollbar or borders)
     * @type {DSBoundingRect}
     */
    get rect(): DSBoundingRect;
    get parentNodes(): DSArea[];
}
export type AreaProps = {
    area: DSArea;
    PS: PubSub;
    zoom: number;
};
import { PubSub } from "./index.js";
import "../types"
