var webSocket = null
var memberList = {};
var targetList = {};
var backoff = 50;

var index = 0;
var numClients = 1;

connect();

chrome.runtime.onInstalled.addListener(function (object) {
  let internalUrl = chrome.runtime.getURL("pages/settings/settings.html");

  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: internalUrl }, function (tab) {
      });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'reset-backoff') {
    backoff = 50;
  } else if (message === 'get-targets') {
    sendResponse(targetList);
  } else if (message === 'get-members') {
    sendResponse(memberList);
  } else if (message === 'get-clients') {
    sendResponse(numClients);
  }
});

async function getTornApiToken() {
  return (await chrome.storage.local.get('tornApiKey'))["tornApiKey"];
}

async function connect() {
  const token = await getTornApiToken();
  webSocket = new WebSocket(`https://ws-torn.rigatoni.app/ws?token=${token}`);
  
  webSocket.onopen = (event) => {
    console.log('websocket open');
    backoff = 50;
    keepAlive();
    queryFaction();
    queryWar();
  };

  webSocket.onmessage = (event) => {
    let data = JSON.parse(event.data);

    if (Array.isArray(data)) {
      processUpdate(data, data.is_target);
    } else if ('NumberOfClients' in data) {
      index = data["Index"];
      numClients = data["NumberOfClients"];
    }
    
  };

  webSocket.onclose = (event) => {
    console.log('websocket connection closed');
    if (backoff < 1000) {
      backoff = backoff*2;
    } else if (backoff < 10000) {
      backoff = backoff*1.1;
    };
    setTimeout(function() {
      connect();
    }, backoff);
  };

}

function disconnect() {
  if (webSocket == null) {
    return;
  }
  webSocket.close();
}

function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () => {
      if (webSocket) {
        webSocket.send('keepalive');
      } else {
        clearInterval(keepAliveIntervalId);
      }
    },
    10000
  );
}

async function mesgServer(message) {
  if (await webSocket.readyState === webSocket.OPEN ) {
    const payload = await encapsulateMesg(await getTornApiToken(), message)
    await webSocket.send(payload)
  }
}

async function encapsulateMesg(token, message) {
  const payload = {
    "SourceToken": token,
    "Message": message,
  };
  return JSON.stringify(payload);
}

async function queryWar() {
  const result = await (chrome.storage.local.get('tornApiKey'));
  fetch("https://api.torn.com/v2/faction/48040/wars?key="+result.tornApiKey)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
        if (data.wars.ranked !== null && (data.wars.ranked.end === null ||  data.wars.ranked.end > (Date.now()/1000) ) ) {
          data.wars.ranked.factions.forEach((faction) => {
            if (faction.id !== 48040) {
              queryEnemyFaction(faction.id);
            }
          });
        } else {
          targetList = {};
        }
    })
    .catch(error => {
      console.error('Error:', error);
    });
    setTimeout(queryWar, await getOffset());
}

async function queryEnemyFaction(factionid) {
  const result = await (chrome.storage.local.get('tornApiKey'));
  fetch("https://api.torn.com/v2/faction/"+factionid+"/members?key="+result.tornApiKey+"&striptags=true")
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      processFaction(data.members, true);
    })
    .catch(error => {
      console.error('Error:', error);
    });
}


async function queryFaction() {
  const result = await (chrome.storage.local.get('tornApiKey'));
  fetch("https://api.torn.com/v2/faction/46708/members?key="+result.tornApiKey+"&striptags=true")
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      processFaction(data.members, false);
    })
    .catch(error => {
      console.error('Error:', error);
    });
    setTimeout(queryFaction, await getOffset());
}

async function processFaction(data, isTarget = false) {
  console.time(`processFaction, isTarget: ${isTarget}`)
  let newList = [];
  let updateList = [];
  for (let i=0; i< data.length; i++) {
    data[i].is_target = isTarget;
    let memberId = data[i].id;
    newList.push(memberId);
    if (!(await compareMember( memberId, data[i] ) ))
    {
      await updateMember(data[i]);
      updateList.push(data[i]);
    }
  };
  checkForPurge(newList, isTarget);
  mesgServer(updateList);
  console.timeEnd(`processFaction, isTarget: ${isTarget}`)
}

async function compareMember(memberId, member) {
  let memberObj;
  if (member.is_target) {
    memberObj = targetList[memberId];
  } else {
    memberObj = memberList[memberId];
  }
  
  if (memberObj === undefined) {
    return false;
  }

  const newMemberObj = {
    "id": member["id"],
    "name": member["name"],
    "description": member["status"]["description"],
    "details": member["status"]["details"],
    "state": member["status"]["state"],
    "until": member["status"]["until"],
    "lastAction": member["last_action"]["relative"],
    "lastStatus": member["last_action"]["status"],
    "isTarget": member["is_target"]
  };

  if (Object.keys(memberObj).length !== Object.keys(newMemberObj).length) {
    return false;
  }

  for (const key in memberObj) {
    if (memberObj[key] !== newMemberObj[key]) {
      return false;
    }
  }
  return true;
}

async function processUpdate(updateData) {

  for (let i=0; i< updateData.length; i++) {
    if (!(await compareMember( updateData[i].id, updateData[i] ))) {
      updateMember(updateData[i]);
    }
  }
}

async function updateMember(member) {
  
  const memberObj = {
    "id": member["id"],
    "name": member["name"],
    "description": member["status"]["description"],
    "details": member["status"]["details"],
    "state": member["status"]["state"],
    "until": member["status"]["until"],
    "lastAction": member["last_action"]["relative"],
    "lastStatus": member["last_action"]["status"],
    "isTarget": member["is_target"]
  };
  const myId = member.id.toString();
  
  if (member.is_target) {
    targetList[myId] = memberObj;
  } else {
    memberList[myId] = memberObj;
  }

}

async function checkForPurge(newList, isTarget) {
  if (isTarget) {
    Object.keys(targetList).forEach(id => {
      if (!newList.includes(Number(id))) {
        delete targetList[id];
      }
    }); 
  } else {
    Object.keys(memberList).forEach(id => {
      if (!newList.includes(Number(id))) {
        delete memberList[id];
      }
    }); 
  }
}

function getOffset() {
  const currentTime = Math.floor(Date.now() % 32000);
  const offset = Math.floor(32000/numClients);
  const timeSet = index*offset;

  let timeTil = timeSet - currentTime;
  if (timeTil > 0) {
    console.log(`Offset: ${timeTil}`)
    return timeTil;
  } else {
    timeTil = Math.abs(currentTime - 32000) + timeSet;
    console.log(`Offset: ${timeTil}`)
    return timeTil;
  }
}