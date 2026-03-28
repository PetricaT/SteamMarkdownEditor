/* ============================================================
   Steam BBCode Engine
   ============================================================
   Parses Steam-flavored BBCode into:
     1. Highlighted HTML  (for the editor overlay)
     2. Rendered HTML     (for the preview pane)

   Strategy: single-pass tokenizer -> token array -> two renderers.
   ============================================================ */

// ── Token types ───────────────────────────────────────────────
const TK = {
    TAG_OPEN:  "TAG_OPEN",
    TAG_CLOSE: "TAG_CLOSE",
    TEXT:      "TEXT",
    NEWLINE:   "NEWLINE",
};

// Tags that never need a closing tag
const VOID_TAGS = new Set(["hr", "*"]);

// ── Tokenizer ─────────────────────────────────────────────────
export function tokenize(input) {
    const tokens = [];
    // Group 1: complete [tag], [/tag], [tag=value]
    // Group 4: newline
    // Group 5: run of non-[ non-newline characters
    // Group 6: single fallback character (catches lone "[")
    const re = /(\[\/?([\w*]+)(?:=([^\]]*))?\])|(\n)|([^\[\n]+)|(.)/g;
    let m;
    while ((m = re.exec(input)) !== null) {
        if (m[1]) {
            const isClose = m[1][1] === "/";
            tokens.push({
                type:  isClose ? TK.TAG_CLOSE : TK.TAG_OPEN,
                name:  m[2].toLowerCase(),
                value: m[3] ?? null,
                raw:   m[1],
            });
        } else if (m[4]) {
            tokens.push({ type: TK.NEWLINE, raw: "\n" });
        } else {
            tokens.push({ type: TK.TEXT, raw: m[5] ?? m[6] });
        }
    }
    return tokens;
}

// ── Unmatched-tag analysis ────────────────────────────────────
// Returns a Set of token indices that are inside an error region.
//
// An error region starts at an unmatched TAG_OPEN and extends to the
// end of the token array (because the user hasn't typed the close yet).
// The moment [/tag] is typed and the open is matched, both are removed
// from the error set and the red colouring disappears.
//
// Unmatched TAG_CLOSE tokens (close with no preceding open) are also
// flagged individually.
export function findErrorRanges(tokens) {
    // Per-tag-name stack of indices of unmatched opens
    const stacks = Object.create(null);

    for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        if (VOID_TAGS.has(tk.name)) continue;

        if (tk.type === TK.TAG_OPEN) {
            (stacks[tk.name] ?? (stacks[tk.name] = [])).push(i);
        } else if (tk.type === TK.TAG_CLOSE) {
            const stack = stacks[tk.name];
            if (stack && stack.length > 0) {
                stack.pop(); // matched -- no error
            } else {
                // Unmatched close -- flag just this token
                tokens[i]._unmatchedClose = true;
            }
        }
    }

    const errorIndices = new Set();

    // Every unmatched open taints everything from its position to EOF
    for (const name of Object.keys(stacks)) {
        for (const openIdx of stacks[name]) {
            for (let j = openIdx; j < tokens.length; j++) {
                errorIndices.add(j);
            }
        }
    }

    // Unmatched closes are individually red
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]._unmatchedClose) errorIndices.add(i);
    }

    return errorIndices;
}

// ── Highlight renderer ────────────────────────────────────────
// Converts tokens -> syntax-coloured HTML for the editor overlay.
// errorIndices is the Set returned by findErrorRanges().

const C_OPEN  = "#569cd6"; // blue  -- opening tags
const C_CLOSE = "#9cdcfe"; // light -- closing tags
const C_ATTR  = "#ce9178"; // rust  -- attribute values
const C_ERROR = "#f44747"; // red   -- unclosed tag region

export function renderHighlight(tokens, errorIndices) {
    let out = "";

    for (let i = 0; i < tokens.length; i++) {
        const tk    = tokens[i];
        const isErr = errorIndices.has(i);
        console.log(tk);
        console.log(tk.type);
        switch (tk.type) {
            case TK.TEXT:
                // Plain text: red if inside an error region, default otherwise
                out += isErr
                    ? `<span style="color:${C_ERROR}">${escHtml(tk.raw)}</span>`
                    : escHtml(tk.raw);
                break;

            case TK.NEWLINE:
                out += "\n";
                break;

            case TK.TAG_OPEN: {
                const tagColor = isErr ? C_ERROR : C_OPEN;
                const attrColor = isErr ? C_ERROR : C_ATTR;
                out += `<span style="color:${tagColor}">[${tk.name}</span>`;
                if (tk.value != null) {
                    out += `<span style="color:${tagColor}">=</span>`;
                    out += `<span style="color:${attrColor}">${escHtml(tk.value)}</span>`;
                }
                out += `<span style="color:${tagColor}">]</span>`;
                break;
            }

            case TK.TAG_CLOSE: {
                const tagColor = isErr ? C_ERROR : C_CLOSE;
                out += `<span style="color:${tagColor}">[/${tk.name}]</span>`;
                break;
            }
        }
    }

    return out;
}

// ── Preview renderer ──────────────────────────────────────────
export function renderPreviewFull(tokens) {
    let out = "";
    let i   = 0;

    while (i < tokens.length) {
        const tk = tokens[i];

        if (tk.type === TK.TEXT) { out += escHtml(tk.raw); i++; continue; }
        if (tk.type === TK.NEWLINE) { out += "<br>"; i++; continue; }

        const { name, value, type } = tk;
        const isClose = type === TK.TAG_CLOSE;

        if (isClose) {
            switch (name) {
                case "b":       out += "</strong>"; break;
                case "i":       out += "</em>";     break;
                case "u":       out += "</u>";      break;
                case "strike":  out += "</s>";      break;
                case "spoiler": out += "</span></span>"; break;
                case "h1":      out += "</h1>";     break;
                case "h2":      out += "</h2>";     break;
                case "h3":      out += "</h3>";     break;
                case "code":    out += "</code></pre>"; break;
                case "list":    out += "</ul>";     break;
                case "olist":   out += "</ol>";     break;
                case "quote":   out += "</blockquote>"; break;
                case "table":   out += "</table>";  break;
                case "tr":      out += "</tr>";     break;
                case "th":      out += "</th>";     break;
                case "td":      out += "</td>";     break;
                default:        out += escHtml(tk.raw); break;
            }
            i++; continue;
        }

        // Open tags
        switch (name) {
            case "b":       out += "<strong>"; i++; break;
            case "i":       out += "<em>";     i++; break;
            case "u":       out += "<u>";      i++; break;
            case "strike":  out += "<s>";      i++; break;
            case "spoiler": out += "<span class='preview-spoiler'><span>"; i++; break;
            case "h1":      out += "<h1 class='preview-header'>"; i++; break;
            case "h2":      out += "<h2 class='preview-header'>"; i++; break;
            case "h3":      out += "<h3 class='preview-header'>"; i++; break;
            case "hr":      out += "<hr>"; i++; break;
            case "list":    out += "<ul>"; i++; break;
            case "olist":   out += "<ol>"; i++; break;
            case "*":       out += "<li>"; i++; break;
            case "code":    out += "<pre class='preview-code-block'><code>"; i++; break;
            case "table":   out += "<table class='preview-table'>"; i++; break;
            case "tr":      out += "<tr>"; i++; break;
            case "th":      out += "<th>"; i++; break;
            case "td":      out += "<td>"; i++; break;

            case "noparse": {
                i++;
                while (i < tokens.length) {
                    const inner = tokens[i];
                    if (inner.type === TK.TAG_CLOSE && inner.name === "noparse") { i++; break; }
                    out += escHtml(inner.raw);
                    i++;
                }
                break;
            }

            case "url": {
                let href = value ?? "";
                if (href && !/^https?:\/\//i.test(href)) href = "http://" + href;
                i++;
                let linkText = "";
                while (i < tokens.length) {
                    const inner = tokens[i];
                    if (inner.type === TK.TAG_CLOSE && inner.name === "url") { i++; break; }
                    linkText += escHtml(inner.raw);
                    i++;
                }
                if (!linkText) linkText = escHtml(href);
                let domainTag = "";
                try {
                    const domain = new URL(href).hostname;
                    if (!domain.includes("steampowered") && !domain.includes("steamcommunity")) {
                        domainTag = `<span class="untrusted-domain">[${escHtml(domain)}]</span>`;
                    }
                } catch (_) {}
                out += `<a href="${escAttr(href)}" class="link-preview" target="_blank" rel="noopener">${linkText}</a>${domainTag}`;
                break;
            }

            case "quote": {
                const author = value ? `<cite>${escHtml(value)}</cite>` : "";
                out += `<blockquote class="preview-quote">${author}`;
                i++;
                break;
            }

            default:
                out += escHtml(tk.raw);
                i++;
                break;
        }
    }

    return out;
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escAttr(str) {
    return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}