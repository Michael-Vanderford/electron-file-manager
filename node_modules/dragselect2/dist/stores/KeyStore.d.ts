export default class KeyStore {
    /**
     * @class KeyStore
     * @constructor KeyStore
     * @param {{DS:DragSelect,multiSelectKeys:DSMultiSelectKeys,multiSelectMode:boolean}} p
     * @ignore
     */
    constructor({ DS, multiSelectKeys, multiSelectMode }: {
        DS: DragSelect;
        multiSelectKeys: DSMultiSelectKeys;
        multiSelectMode: boolean;
    });
    /**
     * @type {boolean}
     * @private
     * */
    private _multiSelectMode;
    /**
     * @type {DSMultiSelectKeys}
     * @private
     * */
    private _multiSelectKeys;
    /**
     * @type {Set<string>}
     * @private
     * */
    private _currentValues;
    /**
     * @type {{control:string,shift:string,meta:string}}
     * @private
     * */
    private _keyMapping;
    DS: DragSelect;
    init: () => void;
    /** @param {KeyboardEvent} event */
    keydown: (event: KeyboardEvent) => void;
    /** @param {KeyboardEvent} event */
    keyup: (event: KeyboardEvent) => void;
    stop: () => void;
    reset: () => void;
    /** @param {KeyboardEvent|MouseEvent|TouchEvent} [event] */
    isMultiSelectKeyPressed(event?: KeyboardEvent | MouseEvent | TouchEvent): boolean;
    get currentValues(): string[];
}
import DragSelect from "../DragSelect";
import "../types"
