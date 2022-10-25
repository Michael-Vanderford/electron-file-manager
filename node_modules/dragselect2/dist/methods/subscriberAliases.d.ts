declare function _default({ subscribe, publish, Interaction, SelectedSet }: {
    subscribe: DSSubscribe;
    publish: DSPublish;
    Interaction: Interaction;
    SelectedSet: SelectedSet;
}): void;
export default _default;
export type DSSubscribe = Function;
export type DSPublish = Function;
import { Interaction } from "../modules";
import { SelectedSet } from "../modules";
import "../types"
