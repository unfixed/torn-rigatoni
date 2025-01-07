
(async () => {
    let tornApiKey = (await chrome.storage.local.get('tornApiKey'))["tornApiKey"];
    let enabler = document.getElementById("Torn-Enable");
    if ((!tornApiKey) || tornApiKey == '') {
        enabler.checked = "";
        enabler.disabled = true;
        document.getElementById("TornKey-Required").classList.remove("hidden");
    }
    else {
        document.getElementById("TornApiKey").value = tornApiKey;
        enabler.disabled = false;
        enabler.checked = (await chrome.storage.local.get('Enabled'))["Enabled"];
        document.getElementById("TornKey-Required").classList.add("hidden");
    }
    
    const saveButton = document.getElementById("TornApiKey-Save");
    saveButton.addEventListener("click", saveSettings);
    enabler.addEventListener("click", toggleEnable);
})();

// function initialize() {

//     var tornApiKey = window.localStorage.getItem('TornApi');
//     if ((!tornApiKey) || tornApiKey == '') {
//     }
//     else {console.log(tornApiKey)}
    
//     const saveButton = document.querySelector("#TornApiKey-Save");
//     saveButton.addEventListener("click", saveSettings);
// }



async function saveSettings() {
    let tornApiKey = await (document.getElementById("TornApiKey").value);
    chrome.storage.local.set({ "tornApiKey": tornApiKey });
    if ((!tornApiKey) || tornApiKey == '') {
        let enabler = document.getElementById("Torn-Enable");
        console.log(enabler.checked)
        enabler.checked = false;
        enabler.disabled = true;
        document.getElementById("TornKey-Required").classList.remove("hidden");
        chrome.storage.local.set({ "Enabled": false });
    } else {
        chrome.runtime.sendMessage('get-targets');
        let enabler = document.getElementById("Torn-Enable");
        enabler.disabled = false;
        document.getElementById("TornKey-Required").classList.add("hidden");
        chrome.storage.local.set({ "Enabled": enabler.checked });
    }
}



async function toggleEnable() {
    let enabler = document.getElementById("Torn-Enable");
    chrome.storage.local.set({ "Enabled": enabler.checked });
    console.log(enabler.checked);
}
