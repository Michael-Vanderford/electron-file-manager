export default class SelectorArea {
    /**
     * @class SelectorArea
     * @constructor SelectorArea
     * @param {{ DS:DragSelect, selectorAreaClass:string, autoScrollSpeed:number, overflowTolerance:Vect2}} obj
     * @ignore
     */
    constructor({ DS, selectorAreaClass, autoScrollSpeed, overflowTolerance }: {
        DS: DragSelect;
        selectorAreaClass: string;
        autoScrollSpeed: number;
        overflowTolerance: Vect2;
    });
    /**
     * @type {number}
     * @private
     * */
    private _autoScrollSpeed;
    /**
     * @type {*}
     * @private
     * */
    private _scrollInterval;
    /**
     * @type {DSBoundingRect}
     * @private
     */
    private _rect;
    /**
     * @type {DSEdges}
     * @private
     */
    private currentEdges;
    /**
     * @type {Vect2}
     * @private
     */
    private _overflowTolerance;
    DS: DragSelect;
    HTMLNode: HTMLDivElement;
    start: () => void;
    /**
     * Adding / Removing elements to document
     * @param {'append'|'remove'} method
     */
    applyElements: (method?: 'append' | 'remove') => void;
    /** Updates the selectorAreas positions to match the areas */
    updatePos: () => void;
    stop: (remove: any) => void;
    startAutoScroll: () => void;
    /** Creates an interval that auto-scrolls while the cursor is near the edge */
    handleAutoScroll: () => void;
    stopAutoScroll: () => void;
    /**
     * Checks if the element is either inside the Selector Area
     * (as a reachable child or touching the area)
     * @param {DSElement} element
     * @param {DSBoundingRect} [elementRect] - slight performance improvements
     * @returns {boolean}
     */
    isInside: (element: DSElement, elementRect?: DSBoundingRect) => boolean;
    /**
     * checks if the click was triggered on the area.
     * @param {DSEvent} [event]
     * @returns {boolean}
     */
    isClicked(event?: DSEvent): boolean;
    get rect(): DSBoundingRect;
}
import DragSelect from "../DragSelect.js";
import "../types"
