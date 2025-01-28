var webSocket = null
var memberList = {};
var targetList = {};
var spyReports = {};
var spyTimeouts = {};

var backoff = 50;
var spyReportTimeout = 0;
var reportCount = 0;

var index = 0;
var numClients = 1;

connect();

async function mesgTab(updateList, isTarget) {

  chrome.tabs.query({ active: true }, ([tab]) => {
    if (chrome.runtime.lastError)
      console.error(chrome.runtime.lastError);
    
    if ( !isTarget && tab.url.includes("pages/memberlist/memberlist.html") ) {
      chrome.tabs.sendMessage(tab.id, JSON.stringify(updateList));
    } else if ( isTarget && tab.url.includes("pages/targetlist/targetlist.html") ) {
      chrome.tabs.sendMessage(tab.id, JSON.stringify(updateList));
    }
    
  });

}

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
  } else if (message === 'get-spies') {
    sendResponse(spyReports);
  }
});

async function getTornStatsApiToken() {
  return (await chrome.storage.local.get('tornStatsApiKey'))["tornStatsApiKey"];
}

async function getTornApiToken() {
  return (await chrome.storage.local.get('tornApiKey'))["tornApiKey"];
}

async function getFactionId() {
  return (await chrome.storage.local.get('FactionId'))["FactionId"];
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

async function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () =>  {
      if (webSocket.readyState === webSocket.OPEN ) {
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
  const token = await getTornApiToken();
  const factionid = await getFactionId();
  fetch("https://api.torn.com/v2/faction/"+factionid+"/wars?key="+token)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
        if (data.wars.ranked !== null && (data.wars.ranked.end === null ||  data.wars.ranked.end > (Date.now()/1000) ) ) {
          data.wars.ranked.factions.forEach((faction) => {
            if (faction.id !== factionid) {
              queryEnemyFaction(faction.id);
            }
          });
        } else {
          targetList = {};
        }
    })
    .catch(error => {
      console.log('Error:', error);
    });
    setTimeout(queryWar, await getOffset());
}

async function querySpyReport(memberid) {
  token = await getTornStatsApiToken();

  if (spyReportTimeout < Math.floor(Date.now() / 1000)) {
    reportCount += 1;
    if (reportCount > 10) {
      spyReportTimeout = Math.floor(Date.now() / 1000) + 60;
      reportCount = 0;
    }
    console.log(memberid);
    fetch("https://www.tornstats.com/api/v2/"+token+"/spy/user/"+memberid)
      .then(response => {
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {        
        
        if (data.status === true && data.spy.status === true) {
          spyReports[memberid] = {
            "battleStatsTotal": data["spy"]["status"]["total"],
            "spyReportAge": data["spy"]["status"]["total_timestamp"]
          };
        } else {
          spyTimeouts[memberid] = Math.floor(Date.now() / 1000) + 3600 + (Math.floor(Math.random() * 21600))
        }
        
  
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }
}

async function queryFactionReport() {
  const token = await getTornStatsApiToken();
  const factionid = await getFactionId();
  fetch("https://www.tornstats.com/api/v2/"+token+"/spy/faction/"+factionid)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {

      if (data.status === true) {
        for (const id in data.faction.members) {
          if ("spy" in data.faction.members[id]) {
            spyReports[id] = {
              "spyTotal": data.faction.members[id].spy.total,
              "spyTimestamp": data.faction.members[id].spy.timestamp
            }
          }
        }
      }

    })
    .catch(error => {
      console.error('Error:', error);
    });
}

async function queryEnemyFaction(factionid) {
  const token = await getTornApiToken();
  fetch("https://api.torn.com/v2/faction/"+factionid+"/members?key="+token+"&striptags=true")
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
  const token = await getTornApiToken();
  const factionid = await getFactionId();
  fetch("https://api.torn.com/v2/faction/"+factionid+"/members?key="+token+"&striptags=true")
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
  let timestamp = Date.now()
  let newList = [];
  let updateList = [];
  let updateMemberList = [];
  for (let i=0; i< data.length; i++) {
    data[i].timestamp = timestamp;
    data[i].is_target = isTarget;
    let memberId = data[i].id;

    newList.push(memberId);
    if (!(await compareMember( memberId, data[i] ) ))
    {
      await updateMember(data[i]);
      updateList.push(data[i]);
      const newMemberObj = {
        "id": data[i].id,
        "name": data[i].name,
        "level": data[i].level,
        "timestamp": data[i].timestamp,
        "description": data[i].status.description,
        "details": data[i].status.details,
        "state": data[i].status.state,
        "until": data[i].status.until,
        "lastAction": data[i].last_action.timestamp,
        "lastStatus": data[i].last_action.status,
        "isTarget": data[i].is_target,
      };
      updateMemberList.push(newMemberObj);
    }
  };
  checkForPurge(newList, isTarget);
  mesgServer(updateList);
  mesgTab(updateMemberList, isTarget);
  checkForMissingSpyReport(isTarget);
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
    console.log("compare::member did not exist")
    return false;
  }

  if (member.timestamp <= memberObj.timestamp) {
    console.log("compare::member timestamp change")
    return false;
  }

  const newMemberObj = {
    "id": member["id"],
    "name": member["name"],
    "level": member["level"],
    "timestamp": member["timestamp"],
    "description": member["status"]["description"],
    "details": member["status"]["details"],
    "state": member["status"]["state"],
    "until": member["status"]["until"],
    "lastAction": member["last_action"]["timestamp"],
    "lastStatus": member["last_action"]["status"],
    "isTarget": member["is_target"],
    // "":
  };

  if (Object.keys(memberObj).length !== Object.keys(newMemberObj).length) {
    console.log("compare::member keys numbers did not match")
    return false;
  }

  for (const key in memberObj) {
    if (memberObj[key] !== newMemberObj[key]) {
      console.log(`compare::member key did not match::${key}`)
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

  let memberObj = null;
  if (member.is_target) {
    memberObj = targetList[member.id.toString()];
  } else {
    memberObj = memberList[member.id.toString()];
  }

  if (memberObj === undefined) {

    memberObj = {
      "id": member["id"],
      "name": member["name"],
      "level": member["level"],
      "timestamp": member["timestamp"],
      "description": member["status"]["description"],
      "details": member["status"]["details"],
      "state": member["status"]["state"],
      "until": member["status"]["until"],
      "lastAction": member["last_action"]["timestamp"],
      "lastStatus": member["last_action"]["status"],
      "isTarget": member["is_target"]
    };
  } else {
    memberObj["id"] = member["id"];
    memberObj["name"] = member["name"];
    memberObj["level"] = member["level"];
    memberObj["timestamp"] = member["timestamp"];
    memberObj["description"] = member["status"]["description"];
    memberObj["details"] = member["status"]["details"];
    memberObj["state"] = member["status"]["state"];
    memberObj["until"] = member["status"]["until"];
    memberObj["lastAction"] = member["last_action"]["timestamp"];
    memberObj["lastStatus"] = member["last_action"]["status"];
    memberObj["isTarget"] = member["is_target"];
  }

  if (member.is_target) {
    targetList[member.id.toString()] = memberObj;
  } else {
    memberList[member.id.toString()] = memberObj;
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

async function checkForMissingSpyReport(isTarget) {
  if (isTarget) {
    Object.keys(targetList).forEach(id => {
      if (!(id in spyReports)) {
        // console.log(`missing spy report for target ${id}`)
        if ( !(id in spyTimeouts) || Math.floor(Date.now() / 1000) > spyTimeouts[id]) {
          querySpyReport(id);
        }
      }
    }); 
  } else {
    for (const id in memberList) {
      if (!(id in spyReports)) {
        // console.log(`missing spy report for member ${id}`)
        queryFactionReport();
        break;
      }
    } 
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
