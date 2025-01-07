var webSocket = null
var memberList = {};
var backoff = 50;

var index = 0;
var numClients = 1;

connect();

chrome.runtime.onInstalled.addListener(function (object) {
  let internalUrl = chrome.runtime.getURL("pages/settings/settings.html");

  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: internalUrl }, function (tab) {
          console.log("New tab launched with http://yoursite.com/");
      });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'get-targets') {
    sendResponse(memberList);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'get-clients') {
    sendResponse(numClients);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'reset-backoff') {
    backoff = 50;
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
  };

  webSocket.onmessage = (event) => {
    let data = JSON.parse(event.data);

    if (Array.isArray(data)) {
      processUpdate(data);
    } else if ('NumberOfClients' in data) {
      console.log(data)
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



// async function queryWar() {

//   fetch("https://api.torn.com/v2/faction/wars?key="+(await chrome.storage.local.get('tornApiKey'))["tornApiKey"])
//     .then(response => {
//       if (!response.ok) {
//         throw new Error('Network response was not ok');
//       }
//       return response.json();
//     })
//     .then(data => {
//       // console.log(data);
//     })
//     .catch(error => {
//       console.error('Error:', error);
//     });


// }

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
      processFaction(data.members);
    })
    .catch(error => {
      console.error('Error:', error);
    });
    setTimeout(queryFaction, await getOffset());
}

async function processFaction(data) {
  console.time("processFaction")
  let newList = [];
  let updateList = [];
  for (let i=0; i< data.length; i++) {
    let memberId = data[i].id;
    newList.push(memberId);
    if (!(await compareMember( memberId ,data[i] ) ))
    {
      await updateMember(data[i]);
      updateList.push(data[i]);
    }
 
  };
  checkForPurge(newList);
  mesgServer(updateList);
  console.timeEnd("processFaction")
}



async function compareMember(memberId, member) {

  const memberObj = memberList[memberId]

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
    "lastStatus": member["last_action"]["status"]
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
  // console.time("processUpdate");

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
    "lastStatus": member["last_action"]["status"]
  };
  const myId = member.id.toString();
  
  memberList[myId] = memberObj;

}

async function checkForPurge(newList) {
  Object.keys(memberList).forEach(id => {
    if (!newList.includes(Number(id))) {
      delete memberList[id];
    }
  });  
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