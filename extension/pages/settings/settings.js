
(async () => {
    console.log("test");
    // var tornApiKey = await chrome.storage.local.get(["tornApiKey"]);+
    let tornApiKey = (await chrome.storage.local.get('tornApiKey'))["tornApiKey"];

    if ((!tornApiKey) || tornApiKey == '') {
        //console.error("No API Key!");
    }
    else {
        document.getElementById("TornApiKey").value = tornApiKey;
    }
    
    const saveButton = document.getElementById("TornApiKey-Save");
    saveButton.addEventListener("click", saveSettings);
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

    await chrome.storage.local.set({ "tornApiKey": tornApiKey })

    // await console.log((await chrome.storage.local.get('tornApiKey')));
}


