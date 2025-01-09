var countdowns = [];
var timeEvals = {};
var memberRoster = {};
var untilMutex = {};

checkEnabled()

async function checkEnabled(){
    const enabled = (await chrome.storage.local.get("Enabled"))["Enabled"];
    if (enabled != true) { 
        console.log("not enabled");
        setTimeout(checkEnabled,5000)
    } else {
        await getUpdates();
        var updateMemberListUi =  setInterval(getUpdates, 500);
        var evalCountDownsUi = setInterval(evalCountDowns, 1000);
        var evalTimeSinceUi = setInterval(evalTimeSince, 5000);
        var updateBattleStatsUi = setInterval(updateBattleStats, 60000);
        updateBattleStats();
    }
}

async function updateBattleStats() {
    const enabled = (await chrome.storage.local.get("Enabled"))["Enabled"];
    if (enabled != true) { console.log("not enabled"); return }

    console.log("updateBattleStats")

    chrome.runtime.sendMessage('get-spies', (spies) => {
        for (const index in spies) {
            if ((Object.keys(memberRoster).includes(index))) {
                
                const element = document.getElementById(`id-${index}-battlestats`);
                if (element == null ) {
                    const newTargetElement = document.createElement("div");
                    newTargetElement.id = `id-${index}-battlestats`;
                    newTargetElement.classList.add("flex");
                    newTargetElement.textContent = evalBattleStats(spies[index].spyTotal);
                    newTargetElement.className = evalBattleStatsColor(spies[index].spyTotal);

                    document.getElementById(`id-${index}`).insertBefore(newTargetElement, document.getElementById(`id-${index}-state`));
                }
            } else {
                console.log("")
            }
        }
    });
}

async function getUpdates() {
    const enabled = (await chrome.storage.local.get("Enabled"))["Enabled"];
    if (enabled != true) { console.log("not enabled"); return }
    
    chrome.runtime.sendMessage('get-targets', (targets) => {
        for (const index in targets) {
            
            if (!(Object.keys(memberRoster).includes(index))) {
                memberRoster[index] = targets[index];
                createMemberUiObject(index, targets[index]);
            } else {
                if (targets[index].lastStatus !== memberRoster[index].lastStatus || targets[index].lastAction !== memberRoster[index].lastAction) {
                    memberRoster[index].lastStatus = targets[index].lastStatus;
                    memberRoster[index].lastAction = targets[index].lastAction;
                    updateLastActionUiElement(index,targets[index].lastAction,targets[index].lastStatus);
                }
                if (targets[index].state !== memberRoster[index].state) {
                    memberRoster[index].state = targets[index].state;
                    updateStateUiElement(index,targets[index].state);
                }
                if (targets[index].until !== memberRoster[index].until) {
                    memberRoster[index].until = targets[index].until;
                    updateUntilUiElement(index,targets[index].until);
                }
            }

        }

        
    });

    chrome.runtime.sendMessage('get-clients', (clients) => {
        const element = document.getElementById(`clients-connected`);
        element.textContent = `${clients} Clients Connected to Relay (~${32/clients}s update interval)`;
    });
}


async function createMemberUiObject(memberid,data) {
    
    const element = document.getElementById(`id-${memberid}`);
    if (element == null ) {
        const newTargetElement = document.createElement("div");
        newTargetElement.id = `id-${memberid}`;
        newTargetElement.classList.add("flex", "py-1");
        
        const newTargetLastElement = document.createElement("div");
        newTargetLastElement.id = `id-${memberid}-last`;
        newTargetLastElement.title = timeSince(data["lastAction"]);
        if (data["lastAction"] > 0) {
            timeEvals[memberid] = data["lastAction"];
        }
        switch (data["lastStatus"]) {
            case "Online":
                newTargetLastElement.classList.add("inline-flex", "h-4", "w-4", "rounded-full", "bg-green-500");
                break;
            case "Idle":
                newTargetLastElement.classList.add("inline-flex", "h-4", "w-4", "rounded-full", "bg-yellow-500");
                break;
            case "Offline":
                newTargetLastElement.classList.add("inline-flex", "h-4", "w-4", "rounded-full", "bg-red-500");
                break;
        }
        const newTargetNameContainerElement = document.createElement("div");
        newTargetNameContainerElement.classList.add("inline-flex", "px-1");

        const newTargetNameElement = document.createElement("div");
        newTargetNameElement.id = `id-${memberid}-name`;
        newTargetNameElement.classList.add("inline-flex", "px-2", "bg-gray-600", "rounded-md");
        newTargetNameElement.textContent = data["name"];

        const newTargetLinkElement = document.createElement("a");
        newTargetLinkElement.href = `https://www.torn.com/profiles.php?XID=${memberid}`;
        newTargetLinkElement.target = "_blank";

        const newTargetLevelElement = document.createElement("div");
        newTargetLevelElement.id = `id-${memberid}-level`;
        newTargetLevelElement.classList.add("inline-flex", "px-2");
        newTargetLevelElement.textContent = "Level: "+data["level"];

        const newTargetStateElement = document.createElement("div");
        newTargetStateElement.id = `id-${memberid}-state`;
        newTargetStateElement.textContent = data["state"];
        switch (data["state"]) {
            case "Okay":
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-green-500");
                break;
            case "Abroad":
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-blue-500");
                break;
            case "Traveling":
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-yellow-500");
                break;
            case "Hospital":
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-red-500");
                break;
            case "Jail":
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-orange-500");
                break;
        }

        const newTargetUntilElement = document.createElement("div");
        newTargetUntilElement.id = `id-${memberid}-until`;
        newTargetUntilElement.classList.add("inline-flex", "pl-1");
        newTargetUntilElement.textContent = timeLeft(data["until"],memberid);
        if (data["until"] > 0) {
            countdowns.push([memberid, data["until"]])
        }   

        newTargetElement.appendChild(newTargetLastElement);
        newTargetElement.appendChild(newTargetLinkElement);
        newTargetLinkElement.appendChild(newTargetNameContainerElement);
        newTargetNameContainerElement.appendChild(newTargetNameElement);
        newTargetElement.appendChild(newTargetLevelElement);
        newTargetElement.appendChild(newTargetStateElement);
        newTargetElement.appendChild(newTargetUntilElement);
        document.body.appendChild(newTargetElement); 
    } 
}

function timeLeft(timeStamp,memberid) {
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = timeStamp - now;

    if (timeDiff < 0 && memberRoster[memberid].state === "Hospital") {
        return "Might be out of Hospital!";
    }

    const days = Math.floor(timeDiff / 86400);
    const hours = Math.floor((timeDiff % 86400) / 3600);
    const minutes = Math.floor((timeDiff % 3600) / 60);
    const seconds = Math.floor(timeDiff % 60);

    let result = "";
    if (days > 0) {
    result += `${days} days `;
    }
    if (hours > 0) {
    result += `${hours} hours `;
    }
    if (minutes > 0) {
    result += `${minutes} minutes `;
    }
    if (seconds >= 0 && result !== "") {
        result += `${seconds} seconds `;
    } else if (seconds > 0 ) {
        result += `${seconds} seconds `;
    }

    return result.trim();
}

async function evalCountDowns() {
    if (countdowns.length <= 0) {
        return
    }
    
    await countdowns.map(async (item, index) => {
        const Output = timeLeft(item[1],item[0]);
        let element = document.getElementById(`id-${item[0]}-until`);
        if (untilMutex[item[0]] === true)
            return
        element.textContent = Output;
        
        if (Output === "") {
            countdowns.pop(index);
        }
      });

}

async function evalTimeSince() {
    if (timeEvals.length <= 0) {
        return
    }
 
    const allkeys = Object.keys(timeEvals);
    allkeys.forEach((index) => {
        const Output = timeSince(timeEvals[index]);
        let element = document.getElementById(`id-${index}-last`);
        element.title = Output;
      });

}

function updateStateUiElement(memberid,state) {
    const element = document.getElementById(`id-${memberid}-state`);
    element.textContent = state;
    switch (state) {
        case "Okay":
            element.className = "inline-flex pl-1 text-green-500";
            break;
        case "Abroad":
            element.className = "inline-flex pl-1 text-blue-500";
            break;
        case "Traveling":
            element.className = "inline-flex pl-1 text-yellow-500";
            break;
        case "Hospital":
            element.className = "inline-flex pl-1 text-red-500";
            break;
        case "Jail":
            element.className = "inline-flex pl-1 text-orange-500";
            break;
    }
}
function updateUntilUiElement(memberid,until) {
    const element = document.getElementById(`id-${memberid}-until`);
    while (untilMutex[memberid] === true) {
        
    }
    untilMutex[memberid] = true;
    element.textContent = timeLeft(until,memberid);
    untilMutex[memberid] = false;
}
function updateLastActionUiElement(memberid,lastAction,lastStatus) {
    const element = document.getElementById(`id-${memberid}-last`);
    element.title = timeSince(lastAction);
    if (lastAction > 0) {
        timeEvals[memberid] = lastAction;
    }   
    switch (lastStatus) {
        case "Online":
            element.className = "inline-flex h-4 w-4 rounded-full bg-green-500";
            break;
        case "Idle":
            element.className = "inline-flex h-4 w-4 rounded-full bg-yellow-500";
            break;
        case "Offline":
            element.className = "inline-flex h-4 w-4 rounded-full bg-red-500";
            break;
    }
}

function timeSince(timeStamp) {
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - timeStamp;

    if (timeDiff <= 0) {
        return "";
    }

    const days = Math.floor(timeDiff / 86400);
    const hours = Math.floor((timeDiff % 86400) / 3600);
    const minutes = Math.floor((timeDiff % 3600) / 60);
    const seconds = Math.floor(timeDiff % 60);

    let result = "";
    if (days > 0) {
    result += `${days} days `;
    }
    if (hours > 0) {
    result += `${hours} hours `;
    }
    if (minutes > 0) {
    result += `${minutes} minutes `;
    }
    if (seconds > 0) {
    result += `${seconds} seconds `;
    }

    return result.trim();
}



function evalBattleStats(battlestats) {

    const billions = Math.floor(battlestats / 1000000000);
    const millions = Math.floor(battlestats / 1000000);
    const thousands = Math.floor(battlestats / 1000);

    let result = "";
    if (billions > 0) {
        result += `${billions}.${Math.floor(battlestats % 1000000000).toString().substring(0,2)}B`;
        return result.trim();
    }
    if (millions > 0) {
        result += `${millions}.${Math.floor(battlestats % 1000000).toString().substring(0,2)}M`;
        return result.trim();
    }
    if (thousands > 0) {
        result += `${thousands},${Math.floor(battlestats % 1000)}`;
        return result.trim();
    }
    if (battlestats > 0) {
        result += `${battlestats}`;
        return result.trim();
    }

    return result.trim();
}

function evalBattleStatsColor(battlestats) {

    if (battlestats > 1000000000) {
        return "rounded-md px-2 bg-red-100 text-red-800";
    }
    if (battlestats < 1000000000 && battlestats > 200000000) {
        return "rounded-md px-2 bg-orange-100 text-orange-600";
    }
    if (battlestats < 200000000 && battlestats > 25000000) {
        return "rounded-md px-2 bg-blue-100 text-blue-600";
    }
    if (battlestats < 25000000 && battlestats > 1000000) {
        return "rounded-md px-2 bg-purple-100 text-purple-600";
    }

    return "rounded-md px-2 bg-green-100 text-green-600";
}