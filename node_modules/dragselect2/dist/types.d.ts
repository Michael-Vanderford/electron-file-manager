/**
 * The Settings to be passed to the Class
 */
type Settings = {
    /**
     * area in which you can drag. If not provided it will be the whole document
     */
    area?: HTMLElement | SVGElement | HTMLDocument;
    /**
     * the elements that can be selected
     */
    selectables?: DSInputElements;
    /**
     * Speed in which the area scrolls while selecting (if available). Unit is pixel per movement.
     */
    autoScrollSpeed?: number;
    /**
     * Tolerance for autoScroll (how close one has to be near an edges for autoScroll to start)
     */
    overflowTolerance?: Vect2;
    /**
     * Zoom scale factor (in case of using CSS style transform: scale() which messes with real positions). Unit scale zoom.
     */
    zoom?: number;
    /**
     * if set to true, no styles (except for position absolute) will be applied by default
     */
    customStyles?: boolean;
    /**
     * Add newly selected elements to the selection instead of replacing them
     */
    multiSelectMode?: boolean;
    /**
     * Whether or not to toggle already active elements while multi-selecting
     */
    multiSelectToggling?: boolean;
    /**
     * Keys that allows switching to the multi-select mode (see the multiSelectMode option). Any key value is possible ([see MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)). Note that the best support is given for <kbd>Control</kbd>, <kbd>Shift</kbd> and <kbd>Meta</kbd>. Provide an empty array `[]` if you want to turn off the functionality.
     */
    multiSelectKeys?: DSMultiSelectKeys;
    /**
     * the square that will draw the selection
     */
    selector?: HTMLElement;
    /**
     * When a user is dragging on an already selected element, the selection is dragged.
     */
    draggability?: boolean;
    /**
     * Whether an element is draggable from the start or needs to be selected first
     */
    immediateDrag?: boolean;
    /**
     * Whether or not the user can drag with the keyboard (we don't recommend disabling it)
     */
    keyboardDrag?: boolean;
    /**
     * The keys available to drag element using the keyboard.
     */
    dragKeys?: DSDragKeys;
    /**
     * The speed at which elements are dragged using the keyboard. In pixels per keydown.
     */
    keyboardDragSpeed?: number;
    /**
     * Whether to use hardware accelerated css transforms when dragging or top/left instead
     */
    useTransform?: boolean;
    /**
     * the class assigned to the mouse hovered items
     */
    hoverClass?: string;
    /**
     * the class assigned to the elements that can be selected
     */
    selectableClass?: string;
    /**
     * the class assigned to the selected items
     */
    selectedClass?: string;
    /**
     * the class assigned to the square selector helper
     */
    selectorClass?: string;
    /**
     * the class assigned to the square in which the selector resides. By default it's invisible
     */
    selectorAreaClass?: string;
    /**
     * Deprecated: please use DragSelect.subscribe('callback', callback) instead
     */
    callback?: DSCallback;
    /**
     * Deprecated: please use DragSelect.subscribe('onDragMove', onDragMove) instead
     */
    onDragMove?: DSCallback;
    /**
     * Deprecated: please use DragSelect.subscribe('onDragStartBegin', onDragStartBegin) instead
     */
    onDragStartBegin?: DSCallback;
    /**
     * Deprecated: please use DragSelect.subscribe('onDragStart', onDragStart) instead
     */
    onDragStart?: DSCallback;
    /**
     * Deprecated: please use DragSelect.subscribe('onElementSelect', onElementSelect) instead
     */
    onElementSelect?: DSCallback;
    /**
     * Deprecated: please use DragSelect.subscribe('onElementUnselect', onElementUnselect) instead
     */
    onElementUnselect?: DSCallback;
};
/**
 * The Object that is passed back to any callback method
 */
type CallbackObject = {
    /**
     * The items currently selected
     */
    items?: Array<HTMLElement | SVGElement | any>;
    /**
     * The respective event object
     */
    event?: MouseEvent | TouchEvent | KeyboardEvent | Event;
    /**
     * The single item currently interacted with
     */
    item?: HTMLElement | SVGElement | any;
    /**
     * Whether the interaction is a drag or a select
     */
    isDragging?: boolean;
    /**
     * Whether or not the drag interaction is via keyboard
     */
    isDraggingKeyboard?: boolean;
    /**
     * Pressed key (lowercase)
     */
    key?: string;
    scroll_directions?: Array<'top' | 'bottom' | 'left' | 'right' | undefined>;
    scroll_multiplier?: number;
};
type DSCallback = Function;
type Vect2 = {
    x: number;
    y: number;
};
type DSElementPos = {
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
    b: number;
};
type DSEdges = ("left" | "right" | "bottom" | "top")[];
/**
 * area within which you can drag
 */
type DSArea = HTMLElement | SVGElement | HTMLDocument;
/**
 * area in which you can drag
 */
type DSSelectorArea = HTMLElement;
/**
 * the elements that can be selected
 */
type DSInputElements = HTMLElement | SVGElement | (HTMLElement | SVGElement)[];
/**
 * the elements that can be selected
 */
type DSElements = (HTMLElement | SVGElement)[];
/**
 * a single element that can be selected
 */
type DSElement = HTMLElement | SVGElement;
/**
 * en event from a touch or mouse interaction
 */
type DSEvent = MouseEvent | TouchEvent;
/**
 * An array of keys that allows switching to the multi-select mode
 */
type DSMultiSelectKeys = string[];
type DSEventNames = "dragstart" | "dragmove" | "autoscroll" | "elementselect" | "elementunselect" | "callback";
type DSInternalEventNames = "Interaction:init" | "Interaction:start" | "Interaction:end" | "Interaction:update" | "Area:modified" | "Area:scroll" | "PointerStore:updated" | "Selected:added" | "Selected:removed" | "Selectable:click" | "Selectable:pointer" | "KeyStore:down" | "KeyStore:up";
type DSInternalEventNamesPre = "Interaction:init:pre" | "Interaction:start:pre" | "Interaction:end:pre" | "Interaction:update:pre" | "Area:modified:pre" | "Area:scroll:pre" | "PointerStore:updated:pre" | "Selected:added:pre" | "Selected:removed:pre" | "Selectable:click:pre" | "Selectable:pointer:pre" | "KeyStore:down:pre" | "KeyStore:up:pre";
/**
 * the name of the callback
 */
type DSCallbackNames = "dragstart" | "dragmove" | "autoscroll" | "elementselect" | "elementunselect" | "callback" | "Interaction:init" | "Interaction:start" | "Interaction:end" | "Interaction:update" | "Area:modified" | "Area:scroll" | "PointerStore:updated" | "Selected:added" | "Selected:removed" | "Selectable:click" | "Selectable:pointer" | "KeyStore:down" | "KeyStore:up" | "Interaction:init:pre" | "Interaction:start:pre" | "Interaction:end:pre" | "Interaction:update:pre" | "Area:modified:pre" | "Area:scroll:pre" | "PointerStore:updated:pre" | "Selected:added:pre" | "Selected:removed:pre" | "Selectable:click:pre" | "Selectable:pointer:pre" | "KeyStore:down:pre" | "KeyStore:up:pre";
type DSBoundingRect = {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
};
type DSDragKeys = {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
};
type DSModificationCallback = (event: any) => any;
