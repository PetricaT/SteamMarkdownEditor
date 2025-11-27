document.getElementById("editor").value = loadValue("editor");

updatePreview("editor-change");

// Saving and loading functions
function saveValue(e) {
    var id = e.id;
    var value = e.value;
    localStorage.setItem(id, value);
    updatePreview("editor-change");
}

function loadValue(v) {
    if (!localStorage.getItem(v)) {
        return "";
    }
    return localStorage.getItem(v);
}

// Editor settings
function updatePreview(operation) {
    switch (operation) {
        case "compact-view":
            if (document.getElementById("compact-view").checked) {
                document.getElementById("preview-container").style.maxWidth = "423px";
            } else {
                document.getElementById("preview-container").style.maxWidth = "638px";
            }
            break;
        case "wrap-text":
            if (document.getElementById("wrap-text").checked) {
                document.getElementById("editor").style.whiteSpace = "pre-wrap";
            } else {
                document.getElementById("editor").style.whiteSpace = "pre";
            }
            break;
        case "editor-change":
            parseMarkdown();
            break;

        default:
            break;
    }
}

function parseMarkdown() {
    var text = document.getElementById("editor").value;
    text = '<br><br>' + text;
    var untrustedDomain = "";
    // Parse bold tags
    text = text.replaceAll("[b]", "<b>");
    text = text.replaceAll("[/b]", "</b>");
    // Parse italic tags
    text = text.replaceAll("[i]", "<i>");
    text = text.replaceAll("[/i]", "</i>");
    // Parse underline tags
    text = text.replaceAll("[u]", "<u>");
    text = text.replaceAll("[/u]", "</u>");
    // Parse strike tags
    text = text.replaceAll("[strike]", "<s>");
    text = text.replaceAll("[/strike]", "</s>");
    // Parse spoiler
    text = text.replaceAll("[spoiler]", "<span class='preview-spoiler'><span>");
    text = text.replaceAll("[/spoiler]", "</span></span>");
    // Parse headear1-3
    text = text.replaceAll("[h1]", "<h1 class='preview-header'>");
    text = text.replaceAll("[/h1]", "</h1>");
    text = text.replaceAll("[h2]", "<h2 class='preview-header'>");
    text = text.replaceAll("[/h2]", "</h2>");
    text = text.replaceAll("[h3]", "<h3 class='preview-header'>");
    text = text.replaceAll("[/h3]", "</h3>");
    // Parse horizontal rule
    text = text.replaceAll("[hr]", "<hr>");
    // Parse list
    text = text.replaceAll("[list]", "<ul>");
    text = text.replaceAll("[/list]", "</li></ul>");
    // Parse ordered list
    text = text.replaceAll("[olist]", "<ol>");
    text = text.replaceAll("[/olist]", "</li></ol>");
    text = text.replaceAll("[*]", "<li>");
    // Parse code block
    text = text.replaceAll("[code]", "<pre class='preview-code-block'><code>");
    text = text.replaceAll("[/code]", "</code></pre>");

    // Parse newlines
    text = text.replaceAll(/\n/g, "<br>");
    // Parse hyperlinks
    text = text.replaceAll(/\[url=(.*?)\](.*?)\[\/url\]/g, (orig, url, text) => {
        // Handle invalid URLs
        try {
            var domain = new URL(url).hostname; // Errors on invalid urls (don't contain http://)
        } catch (error) {
            if (error.message.includes("is not a valid URL.")) {
                url = "http://" + url;
            } else {
                throw error;
            }
        }

        if (!url.includes("steampowered") && !url.includes("steamcommunity")) {
            if(domain == undefined) {
                domain = url.split("/")[2];
            }
            untrustedDomain = `<div class="untrusted-domain">[${domain}]</div>`;
        }
        return `<a href="${url}" class="link-preview">${text}</a>${untrustedDomain}`;
    });
    document.getElementById("preview-container").innerHTML = text;
    return;
}

function updateLineNumbers() {
    var editor = document.getElementById("editor");
    var lineNumbers = document.getElementById("line-numbers");
    var lines = editor.value.split("\n");
    var lineNumbersHTML = "";
    for (var i = 0; i < lines.length; i++) {
        lineNumbersHTML += "<span>" + (i + 1) + "</span>";
    }
    lineNumbers.innerHTML = lineNumbersHTML;
}
updateLineNumbers();