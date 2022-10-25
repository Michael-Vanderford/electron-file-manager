export default class Drag {
    /**
     * @param {Object} p
     * @param {DragSelect} p.DS
     * @param {boolean} p.draggability
     * @param {boolean} p.useTransform
     * @param {DSDragKeys} p.dragKeys
     * @param {boolean} p.keyboardDrag
     * @param {number} p.keyboardDragSpeed
     * @param {number} p.zoom
     * @ignore
     */
    constructor({ DS, dragKeys, draggability, keyboardDrag, keyboardDragSpeed, useTransform, zoom, }: {
        DS: DragSelect;
        draggability: boolean;
        useTransform: boolean;
        dragKeys: DSDragKeys;
        keyboardDrag: boolean;
        keyboardDragSpeed: number;
        zoom: number;
    });
    /**
     * @type {boolean}
     * @private
     */
    private _useTransform;
    /**
     * @type {Vect2}
     * @private
     */
    private _prevCursorPos;
    /**
     * @type {Vect2}
     * @private
     */
    private _prevScrollPos;
    /**
     * @type {DSElements}
     * @private
     */
    private _elements;
    /**
     * @type {boolean}
     * @private
     */
    private _draggability;
    /**
     * @type {DSDragKeys}
     * @private
     */
    private _dragKeys;
    /**
     * @type {string[]}
     * @private
     */
    private _dragKeysFlat;
    /**
     * @type {boolean}
     * @private
     */
    private _keyboardDrag;
    /**
     * @type {number}
     * @private
     */
    private _keyboardDragSpeed;
    /**
     * @type {number}
     * @private
     */
    private _zoom;
    DS: DragSelect;
    keyboardDrag: ({ event, key }: {
        event: any;
        key: any;
    }) => void;
    keyboardEnd: ({ event, key }: {
        event: any;
        key: any;
    }) => void;
    start: ({ isDragging, isDraggingKeyboard }: {
        isDragging: any;
        isDraggingKeyboard: any;
    }) => void;
    stop: (evt: any) => void;
    update: ({ isDragging, isDraggingKeyboard }: {
        isDragging: any;
        isDraggingKeyboard: any;
    }) => void;
    handleZIndex: (add: any) => void;
    get _cursorDiff(): Vect2;
    get _scrollDiff(): Vect2;
}
import DragSelect from "../DragSelect";
import "../types"
