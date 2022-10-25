export default class Selection {
    /**
     * @constructor Selection
     * @param {{ DS:DragSelect, hoverClassName:string, multiSelectToggling:boolean }} p
     * @ignore
     */
    constructor({ DS, hoverClassName, multiSelectToggling }: {
        DS: DragSelect;
        hoverClassName: string;
        multiSelectToggling: boolean;
    });
    /**
     * @type {Set}
     * @private
     * */
    private _prevSelectedSet;
    /**
     * @type {string}
     * @private
     * */
    private _hoverClassName;
    /**
     * @type {boolean}
     * @private
     * */
    private _multiSelectToggling;
    DS: DragSelect;
    /**
     * Stores the previous selection (solves #9)
     * @param {DSEvent} event
     * @private
     * */
    private _storePrevious;
    /** @param {{event:DSEvent,isDragging:boolean}} event */
    start: ({ event, isDragging }: {
        event: DSEvent;
        isDragging: boolean;
    }) => void;
    update: ({ isDragging }: {
        isDragging: any;
    }) => void;
    /**
     * Checks if any selectable element is inside selection.
     * @param {boolean} [force]
     * @param {DSEvent} [event]
     * @private
     */
    private _handleInsideSelection;
}
import DragSelect from "../DragSelect";
import "../types"
