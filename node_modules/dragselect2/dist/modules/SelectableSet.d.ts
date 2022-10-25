export default class SelectableSet extends Set<any> {
    /**
     * @constructor SelectableSet
     * @param {Object} p
     * @param {DSInputElements} p.elements
     * @param {DragSelect} p.DS
     * @param {string} p.className
     * @param {string} p.hoverClassName
     * @param {boolean} p.useTransform
     * @param {boolean} p.draggability
     * @ignore
     */
    constructor({ elements, className, hoverClassName, draggability, useTransform, DS, }: {
        elements: DSInputElements;
        DS: DragSelect;
        className: string;
        hoverClassName: string;
        useTransform: boolean;
        draggability: boolean;
    });
    /**
     * @type {DSElements}
     * @private
     * */
    private _initElements;
    /**
     * @type {string}
     * @private
     * */
    private _className;
    /**
     * @type {string}
     * @private
     * */
    private _hoverClassName;
    /**
     * @type {boolean}
     * @private
     * */
    private _useTransform;
    /**
     * @type {boolean}
     * @private
     * */
    private _draggability;
    DS: DragSelect;
    init: () => void;
    _onClick: (event: any) => void;
    _onPointer: (event: any) => void;
    /** @param {DSElements} elements */
    addAll: (elements: DSElements) => void;
    /** @param {DSElements} elements */
    deleteAll: (elements: DSElements) => void;
    /** @return {DSElements} */
    get elements(): DSElements;
}
import DragSelect from "../DragSelect";
import "../types"
