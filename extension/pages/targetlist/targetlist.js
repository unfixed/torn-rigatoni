var countdowns = [];

async function getMembers() {
    const items = (await chrome.storage.local.get("memberList"))["memberList"];
    var allKeys = Object.keys(items);
        allKeys.forEach(element => {
            if (!(isNaN(element)) && (element != 0)) {
                updateMemberUiObject(element, items[element]);
            }
        });
}

async function updateMemberUiObject(memberid,data) {
    // console.log(data)
    const element = document.getElementById(`id-${memberid}`);
    if (element == null ) {
        const newTargetElement = document.createElement("div");
        newTargetElement.id = `id-${memberid}`;
        newTargetElement.classList.add("flex");
        // newTargetElement.textContent = JSON.stringify(data);
        
        const newTargetLastElement = document.createElement("div");
        newTargetLastElement.id = `id-${memberid}-last`;
        newTargetLastElement.title = data["lastAction"];
        switch (data["lastStatus"]) {
            case "Online":
                newTargetLastElement.classList.add("inline-flex", "h-3", "w-3", "rounded-full", "bg-green-500");
                break;
            case "Idle":
                newTargetLastElement.classList.add("inline-flex", "h-3", "w-3", "rounded-full", "bg-yellow-500");
                break;
            case "Offline":
                newTargetLastElement.classList.add("inline-flex", "h-3", "w-3", "rounded-full", "bg-red-500");
                break;
        }
        const newTargetNameElement = document.createElement("div");
        newTargetNameElement.id = `id-${memberid}-name`;
        newTargetNameElement.classList.add("inline-flex", "pl-1");
        newTargetNameElement.textContent = data["name"];
    
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
                newTargetStateElement.classList.add("inline-flex", "pl-1", "text-red-800");
                break;
        }

        const newTargetUntilElement = document.createElement("div");
        newTargetUntilElement.id = `id-${memberid}-until`;
        newTargetUntilElement.classList.add("inline-flex", "pl-1");
        newTargetUntilElement.textContent = await timeLeft(data["until"]);
        if (data["until"] > 0) {
            console.log(`added countdown for ${memberid}`)
            countdowns.push([memberid, data["until"]])
        }   

        newTargetElement.appendChild(newTargetLastElement);
        newTargetElement.appendChild(newTargetNameElement);
        newTargetElement.appendChild(newTargetStateElement);
        newTargetElement.appendChild(newTargetUntilElement);
        document.body.appendChild(newTargetElement); 
    } else {
        // element.textContent = JSON.stringify(data);
    }
}

getMembers();
var updateMemberListUi =  setInterval(getMembers, 1000);

async function timeLeft(timeStamp) {
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = timeStamp - now;

    if (timeLeft <= 0) {
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

async function evalCountDowns() {
    if (countdowns.length <= 0) {
        return
    }
    
    await countdowns.map(async (item, index) => {
        const Output = await timeLeft(item[1]);
        let element = document.getElementById(`id-${item[0]}-until`);
        element.textContent = Output;
        if (Output === "") {
            countdowns.pop(index);
        }
      });

}

var x = setInterval(evalCountDowns, 1000);