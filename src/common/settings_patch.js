const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function merge(current, patch) {
    const result = { ...current };
    for (const [key, value] of Object.entries(patch)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe preference key');
        result[key] = object(value) ? merge(object(result[key]) ? result[key] : {}, value) : value;
    }
    return result;
}
function changes(previous, next) {
    const result = {};
    for (const [key, value] of Object.entries(next)) {
        if (JSON.stringify(previous?.[key]) === JSON.stringify(value)) continue;
        result[key] = object(value) && object(previous?.[key]) ? changes(previous[key], value) : value;
    }
    return result;
}
module.exports = { merge, changes, object };
