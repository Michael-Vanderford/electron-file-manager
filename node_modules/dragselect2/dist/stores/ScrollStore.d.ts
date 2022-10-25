export default class ScrollStore {
    /**
     * @class ScrollStore
     * @constructor ScrollStore
     * @param {{ DS:DragSelect, areaElement: DSArea, zoom:number }} p
     * @ignore
     */
    constructor({ DS, areaElement, zoom }: {
        DS: DragSelect;
        areaElement: DSArea;
        zoom: number;
    });
    /**
     * @type {Vect2}
     * @private */
    private _initialVal;
    /**
     * @type {Vect2}
     * @private */
    private _currentVal;
    /**
     * @type {DSArea}
     * @private */
    private _areaElement;
    /**
     * @type {boolean}
     * @private */
    private _canScroll;
    DS: DragSelect;
    zoom: number;
    init: () => void;
    start: () => void;
    update: () => Vect2;
    stop: () => void;
    reset: () => void;
    get canScroll(): boolean;
    get scrollAmount(): {
        x: number;
        y: number;
    };
    get initialVal(): Vect2;
    get currentVal(): Vect2;
}
import DragSelect from "../DragSelect";
import "../types"
