let version = "0.0.1";
let minWidth = 983;
let windowWidth = window.innerWidth;

// Create a copy of the default infobar with variables in plain text
let infobar_default = document.getElementById("infobar-title").innerHTML.replace("{{version}}", version);
// Write it out with default values before the listener runs.

// Run preprocessors on load
main();

// Update header based on windows size
onresize = () => {
    check_resize();
}

function check_resize(){
    windowWidth = window.innerWidth;
    if (windowWidth > minWidth){
        set_infobar(false, false);
    } else if (windowWidth < 619){
        set_infobar(true, true);
    } else {
        set_infobar(true);
    }
}

function set_infobar(colored = false, compact = false){
    let l_tagline = "Online Steam Guide editor |";
    let l_window_width = window.innerWidth;
    let l_Version = `<p class="version">v${version}</p>`;
    let l_min_window_width = `Minimum width: ${minWidth}px`;
    if (compact){
        l_tagline = "";
    }
    if (colored){
        l_window_width = `<p class=\"width-error\"> ${window.innerWidth} </p>`;
    } else {
        l_window_width = `${window.innerWidth}`;
    }
    // Default case
    let infobar_local = `${l_tagline} ${l_Version} | ${l_min_window_width} | Window width: ${l_window_width}`;
    document.getElementById("infobar-title").innerHTML = infobar_local;
}

function main(){
    // Set the initial infobar
    check_resize();
}