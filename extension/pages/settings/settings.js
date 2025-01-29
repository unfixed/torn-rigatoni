
(async () => {
    let tornApiKey = (await chrome.storage.local.get('tornApiKey'))["tornApiKey"];
    let tornStatsApiKey = (await chrome.storage.local.get('tornStatsApiKey'))["tornStatsApiKey"];
    let enabler = document.getElementById("Torn-Enable");
    if ((!tornApiKey) || tornApiKey == '') {
        enabler.checked = "";
        enabler.disabled = true;
        document.getElementById("TornKey-Required").classList.remove("hidden");
    } else if ((!tornStatsApiKey) || tornStatsApiKey == '') {
        enabler.checked = "";
        enabler.disabled = true;
        document.getElementById("TornStatsKey-Required").classList.remove("hidden");
    } else {
        document.getElementById("TornApiKey").value = tornApiKey;
        document.getElementById("TornStatsApiKey").value = tornStatsApiKey;
        enabler.disabled = false;
        enabler.checked = (await chrome.storage.local.get('Enabled'))["Enabled"];
        document.getElementById("TornKey-Required").classList.add("hidden");
        document.getElementById("TornStatsKey-Required").classList.add("hidden");
        queryFaction();
    }
    
    const saveButton = document.getElementById("TornApiKey-Save");
    saveButton.addEventListener("click", saveSettings);
    enabler.addEventListener("click", toggleEnable);
})();


async function saveSettings() {
    let tornApiKey = await (document.getElementById("TornApiKey").value);
    let tornStatsApiKey = await (document.getElementById("TornStatsApiKey").value);
    await chrome.storage.local.set({ "tornApiKey": tornApiKey });
    await chrome.storage.local.set({ "tornStatsApiKey": tornStatsApiKey });
    if ((!tornApiKey) || tornApiKey == '') {
        let enabler = document.getElementById("Torn-Enable");
        enabler.checked = false;
        enabler.disabled = true;
        document.getElementById("TornKey-Required").classList.remove("hidden");
        await chrome.storage.local.set({ "Enabled": false });
    } else {
        document.getElementById("TornKey-Required").classList.add("hidden");
    }    
    if ((!tornStatsApiKey) || tornStatsApiKey == '') {
        let enabler = document.getElementById("Torn-Enable");
        enabler.checked = false;
        enabler.disabled = true;
        document.getElementById("TornStatsKey-Required").classList.remove("hidden");
        await chrome.storage.local.set({ "Enabled": false });
    }  else {
        document.getElementById("TornStatsKey-Required").classList.add("hidden");
    }
    
    if (tornApiKey != '' && tornStatsApiKey != '' && tornApiKey === tornApiKey.trim() && tornStatsApiKey === tornStatsApiKey.trim()) {
        chrome.runtime.sendMessage('get-targets');
        let enabler = document.getElementById("Torn-Enable");
        enabler.disabled = false;
        document.getElementById("TornKey-Required").classList.add("hidden");
        document.getElementById("TornStatsKey-Required").classList.add("hidden");
        await chrome.storage.local.set({ "Enabled": enabler.checked });
    }
}

async function queryFaction() {
    let enabler = document.getElementById("Torn-Enable");
    if ( (await chrome.storage.local.get("Enabled"))["Enabled"]) {
        const token = (await chrome.storage.local.get("tornApiKey"))["tornApiKey"];

        fetch("https://api.torn.com/v2/faction/basic?key="+token)
        .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
        })
        .then(data => {
            if ("basic" in data) {
                document.getElementById("factionName").textContent = data.basic.name;
                document.getElementById("factionNameContainer").classList.remove("hidden");
                chrome.storage.local.set({ "FactionId": data.basic.id });
            } else {
                document.getElementById("factionNameContainer").classList.add("hidden");
            }
        })
        .catch(error => {
        console.log('Error:', error);
        });
    } else {
        document.getElementById("factionNameContainer").classList.add("hidden");
    }

          
    
}

async function toggleEnable() {
    let enabler = document.getElementById("Torn-Enable");
    chrome.storage.local.set({ "Enabled": enabler.checked });
    if (enabler.checked) {
        queryFaction();
    }
}
