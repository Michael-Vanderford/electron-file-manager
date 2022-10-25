export default class SelectedSet extends Set<any> {
    /**
     * @constructor SelectableSet
     * @param {Object} p
     * @param {DragSelect} p.DS
     * @param {string} p.className
     * @ignore
     */
    constructor({ className, DS }: {
        DS: DragSelect;
        className: string;
    });
    /**
     * @type {string}
     * @private
     * */
    private _className;
    DS: DragSelect;
    /**
     * Adds/Removes an element. If it is already selected = remove, if not = add.
     * @param {DSElement} element
     * @return {DSElement}
     */
    toggle(element: DSElement): DSElement;
    /** @param {DSElements} elements */
    addAll: (elements: DSElements) => void;
    /** @param {DSElements} elements */
    deleteAll: (elements: DSElements) => void;
    /** @return {DSElements} */
    get elements(): DSElements;
}
import DragSelect from "../DragSelect";
import "../types"
