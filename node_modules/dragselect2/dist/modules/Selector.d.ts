export default class Selector {
    /**
     * @constructor Selector
     * @param {Object} p
     * @param {DragSelect} p.DS
     * @param {HTMLElement} p.selector
     * @param {string} p.selectorClass
     * @param {boolean} p.customStyles
     * @ignore
     */
    constructor({ DS, selector, selectorClass, customStyles }: {
        DS: DragSelect;
        selector: HTMLElement;
        selectorClass: string;
        customStyles: boolean;
    });
    /**
     * @type {DSBoundingRect}
     * @private
     */
    private _rect;
    DS: DragSelect;
    HTMLNode: HTMLElement;
    start: ({ isDragging }: {
        isDragging: any;
    }) => void;
    stop: () => void;
    /** Moves the selection to the correct place */
    update: ({ isDragging }: {
        isDragging: any;
    }) => void;
    get rect(): DSBoundingRect;
}
import DragSelect from "../DragSelect.js";
import "../types"
