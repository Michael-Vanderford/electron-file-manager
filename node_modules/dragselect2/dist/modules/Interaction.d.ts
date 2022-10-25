export default class Interaction {
    /**
     * @constructor Interaction
     * @param {Object} obj
     * @param {DragSelect} obj.DS
     * @param {DSArea} obj.areaElement
     * @param {boolean} obj.draggability
     * @param {boolean} obj.immediateDrag
     * @param {string} obj.selectableClass
     * @ignore
     */
    constructor({ DS, areaElement, draggability, immediateDrag, selectableClass, }: {
        DS: DragSelect;
        areaElement: DSArea;
        draggability: boolean;
        immediateDrag: boolean;
        selectableClass: string;
    });
    /**
     * @type {DSArea}
     * @private
     * */
    private _areaElement;
    /**
     * @type {boolean}
     * @private
     * */
    private _draggability;
    /**
     * @type {boolean}
     * @private
     * */
    private _immediateDrag;
    /**
     * @type {string}
     * @private
     * */
    private _selectableClass;
    /** @type {boolean} */
    isInteracting: boolean;
    /** @type {boolean} */
    isDragging: boolean;
    DS: DragSelect;
    init: () => void;
    _init: () => void;
    /**
     * @param {DSEvent} event
     */
    _canInteract(event: DSEvent): boolean;
    /**
     * @param {DSEvent} event
     */
    start: (event: DSEvent) => void;
    _start: (event: any) => void;
    /**
     * Drag interaction
     * @param {DSEvent} event
     * @returns {boolean}
     */
    isDragEvent: (event: DSEvent) => boolean;
    /**
     * Triggers when a node is actively selected: <button> nodes that are pressed via the keyboard.
     * Making DragSelect accessible for everyone!
     * @param {{ event:MouseEvent }} prop
     */
    onClick: ({ event }: {
        event: MouseEvent;
    }) => void;
    stop: () => void;
    update: ({ event, scroll_directions, scroll_multiplier }: {
        event: any;
        scroll_directions: any;
        scroll_multiplier: any;
    }) => void;
    reset: (event: any) => void;
    _reset: (event: any) => void;
}
import DragSelect from "../DragSelect";
import "../types"
