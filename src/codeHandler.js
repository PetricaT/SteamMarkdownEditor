import { tokenize, renderHighlight, renderPreviewFull, findErrorRanges } from "./markdownEngine.js";

const editorEl      = document.getElementById("editor");
const highlightEl   = document.getElementById("highlighted-code");
const previewEl     = document.getElementById("preview-container");
const lineNumbersEl = document.getElementById("line-numbers");

// ── Bootstrap ─────────────────────────────────────────────────
(function init() {
    const saved = localStorage.getItem("editor-content") ?? "";
    setEditorContent(saved);
    syncAll();
})();

// ── setEditorContent ──────────────────────────────────────────
// Canonical DOM form: interleaved (textNode?, BR)* nodes.
// A line "foo\nbar" becomes: TEXT("foo") BR TEXT("bar")
// An empty line in "foo\n\nbar" becomes: TEXT("foo") BR BR TEXT("bar")
// This is the only structure getPlainText and setCaretOffset expect.
function setEditorContent(text) {
    editorEl.innerHTML = "";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
            editorEl.appendChild(document.createTextNode(lines[i]));
        }
        if (i < lines.length - 1) {
            editorEl.appendChild(document.createElement("br"));
        }
    }
}

// ── getPlainText ──────────────────────────────────────────────
function getPlainText() {
    let text = "";
    for (const node of editorEl.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeName === "BR") {
            text += "\n";
        } else {
            // Flatten any rogue block the browser inserted
            text += node.innerText ?? node.textContent;
        }
    }
    return text;
}

// ── caretToOffset ─────────────────────────────────────────────
// Converts a (container, offsetInContainer) DOM position to a
// plain-text character offset. Handles two cases:
//
//   A) container is a TEXT node inside editorEl:
//      offsetInContainer is a character index within that node.
//
//   B) container is editorEl itself:
//      offsetInContainer is a child-node index. This happens when
//      the caret sits between block-level children (e.g. after a BR).
//
function caretToOffset(container, offsetInContainer) {
    let count = 0;
    const children = Array.from(editorEl.childNodes);

    // Determine the stopping child index
    let stopChildIndex;
    let stopCharOffset = 0;

    if (container === editorEl) {
        // Case B: stop before child at index offsetInContainer
        stopChildIndex = offsetInContainer;
    } else {
        // Case A: find which child the container is
        stopChildIndex = children.indexOf(container);
        stopCharOffset = offsetInContainer;
    }

    for (let i = 0; i < children.length; i++) {
        if (i === stopChildIndex) {
            count += stopCharOffset;
            return count;
        }
        const node = children[i];
        if (node.nodeType === Node.TEXT_NODE) {
            count += node.textContent.length;
        } else if (node.nodeName === "BR") {
            count += 1;
        }
    }
    return count;
}

function getCaretOffset() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const r = sel.getRangeAt(0);
    return caretToOffset(r.startContainer, r.startOffset);
}

// ── setCaretOffset ────────────────────────────────────────────
// Restores caret to a plain-text character offset in the rebuilt DOM.
function setCaretOffset(offset) {
    const sel   = window.getSelection();
    const range = document.createRange();
    let rem = offset;

    for (const node of editorEl.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent.length;
            if (rem <= len) {
                range.setStart(node, rem);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
            rem -= len;
        } else if (node.nodeName === "BR") {
            if (rem === 0) {
                range.setStartBefore(node);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
            rem -= 1;
        }
    }

    // Offset is at or past end -- place caret after the last node
    const last = editorEl.lastChild;
    if (last) {
        if (last.nodeType === Node.TEXT_NODE) {
            range.setStart(last, last.textContent.length);
        } else {
            range.setStartAfter(last);
        }
    } else {
        range.setStart(editorEl, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

// ── syncAll ───────────────────────────────────────────────────
function syncAll() {
    const raw    = getPlainText();
    const tokens = tokenize(raw);
    const errors = findErrorRanges(tokens);

    highlightEl.innerHTML = renderHighlight(tokens, errors) + "\n";
    previewEl.innerHTML   = renderPreviewFull(tokens);
    updateLineNumbers(raw);
    localStorage.setItem("editor-content", raw);
}

// ── insertAtCaret ─────────────────────────────────────────────
// Used for Enter (\n) and Tab (two spaces). Both are preventDefault'd
// in keydown so no `input` event fires -- we call syncAll ourselves.
function insertAtCaret(str) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range   = sel.getRangeAt(0);
    const selLen  = range.toString().length;
    const caretEnd = getCaretOffset();
    const start   = caretEnd - selLen;
    const raw     = getPlainText();

    const newRaw   = raw.slice(0, start) + str + raw.slice(caretEnd);
    const newCaret = start + str.length;

    setEditorContent(newRaw);
    setCaretOffset(newCaret);
    syncAll();
}

// ── Keyboard ──────────────────────────────────────────────────
editorEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        insertAtCaret("\n");
        return;
    }
    if (e.key === "Tab") {
        e.preventDefault();
        insertAtCaret("  ");
    }
});

// ── Input (backspace, delete, regular chars) ──────────────────
// The browser has mutated the DOM. Read caret + text from the
// mutated state, then immediately rebuild to canonical form.
editorEl.addEventListener("input", () => {
    const offset = getCaretOffset();
    const raw    = getPlainText();
    setEditorContent(raw);
    setCaretOffset(offset);
    syncAll();
});

// ── Paste ─────────────────────────────────────────────────────
editorEl.addEventListener("paste", (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range    = sel.getRangeAt(0);
    const selLen   = range.toString().length;
    const caretEnd = getCaretOffset();
    const start    = caretEnd - selLen;
    const raw      = getPlainText();
    const pasted   = e.clipboardData.getData("text/plain");

    const newRaw   = raw.slice(0, start) + pasted + raw.slice(caretEnd);
    const newCaret = start + pasted.length;

    setEditorContent(newRaw);
    setCaretOffset(newCaret);
    syncAll();
});

// ── Scroll sync ───────────────────────────────────────────────
editorEl.addEventListener("scroll", () => {
    highlightEl.scrollTop  = editorEl.scrollTop;
    highlightEl.scrollLeft = editorEl.scrollLeft;
});

// ── Line numbers ──────────────────────────────────────────────
function updateLineNumbers(raw) {
    const count = (raw.match(/\n/g) ?? []).length + 1;
    if (lineNumbersEl.dataset.count === String(count)) return;
    lineNumbersEl.dataset.count = count;
    let html = "";
    for (let n = 1; n <= count; n++) html += `<span>${n}</span>`;
    lineNumbersEl.innerHTML = html;
}

// ── Editor settings ───────────────────────────────────────────
window.updatePreview = function(operation) {
    switch (operation) {
        case "compact-view":
            previewEl.style.maxWidth = document.getElementById("compact-view").checked ? "423px" : "638px";
            break;
        case "wrap-text":
            editorEl.style.whiteSpace = document.getElementById("wrap-text").checked ? "pre-wrap" : "pre";
            break;
    }
};