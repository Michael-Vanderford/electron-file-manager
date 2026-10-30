// Status markup is constructed here; filenames and errors are always text.
function render_status(element, value) {
    const data = value && typeof value === 'object' ? value : { text: value };
    const text = String(data.text ?? data.message ?? '');
    element.replaceChildren();
    if (data.loading === true) {
        const image = element.ownerDocument.createElement('img');
        image.src = '../renderer/icons/spinner.gif';
        image.alt = 'loading';
        image.className = 'spinner';
        image.style.width = image.style.height = '12px';
        element.append(image, ' ');
    }
    element.append(text);
    return text;
}
module.exports = { render_status };
