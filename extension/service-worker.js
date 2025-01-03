


async function connect() {
  const token = await getTornApiToken();
  webSocket = new WebSocket(`http://localhost:8080/ws?token=${token}`);
  // webSocket = new WebSocket("https://localhost:8080/ws?token=IC9JVltgei13QBTa", null, null, null, {rejectUnauthorized: false});

  
  webSocket.onopen = (event) => {
    console.log('websocket open');
    keepAlive();
    // mesgServer("client");
    queryFaction();
  };

  webSocket.onmessage = (event) => {
    // console.log(`websocket received message: ${event.data}`);
    let data = JSON.parse(event.data);

    if ('Message' in data) {
      let payload = JSON.parse(data.Message)
      console.log(payload)
      if (event.data.length > 10) {
        processUpdate(payload);
      }
      
    }
    
  };

  webSocket.onclose = (event) => {
    console.log('websocket connection closed');
    setTimeout(function() {
      connect();
    }, 1000);
  };

}
var webSocket = null
var memberList = {};
getMemberList();
connect();
// var query =  setInterval(queryFaction, 10500);
setInterval(queryFaction, 30100);

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
    20000
  );
}


async function mesgServer(message) {
  if (await webSocket.readyState === webSocket.OPEN ) {
    // await getTornApiToken()
    const payload = await encapsulateMesg(await getTornApiToken(), message)
    await webSocket.send(payload)
  }
  else {
    webSocket = new WebSocket("http://localhost:8080/ws");
  }
}

async function encapsulateMesg(token, message) {
  const payload = {
    "SourceToken": token.tornApiKey,
    "Message": message,
  };
  return JSON.stringify(payload);
}

async function getTornApiToken() {
  return await chrome.storage.local.get('tornApiKey');
}

async function getMemberList() {
  memberList = await chrome.storage.local.get('memberList');
}

async function queryWar() {

  fetch("https://api.torn.com/v2/faction/wars?key="+(await chrome.storage.local.get('tornApiKey'))["tornApiKey"])
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log(data);
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
      console.log(data.members);
      processFaction(data.members);
    })
    .catch(error => {
      console.error('Error:', error);
    });


}

async function processFaction(data) {
  let memberRoster = [];
  for (let i=0; i< data.length; i++) {

    let memberId = data[i].id;
    memberRoster.push(memberId);
    if (await compareMember( memberId ,data[i] ) )
    {
      // console.log("matched");
    }
    else{ 
      console.log("updating "+(data[i])["id"]);
      updateMember(data[i]);
      mesgServer(JSON.stringify(data[i]));
    }
    checkRoster(memberRoster);
  };

}

async function compareMember(memberId, member) {

  const memberObj = memberList[memberId]

  if (memberObj === undefined) {
    // console.log("not found in local storage, compare failed");
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
    // console.log("key count differs");
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
  const memberId = updateData.id;
  if (await compareMember( memberId, updateData ) )
    {
      console.log("existing data matched update");
    }
    else { 
      console.log("------ updating "+(memberId) +" from new message");
      updateMember(updateData);
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

  chrome.storage.local.set( { memberList: memberList }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error storing data:", chrome.runtime.lastError);
    } else {
      // console.log("Key-value pair successfully stored!");
    }
  });

}

async function checkRoster(memberRoster) {
  
  await chrome.storage.local.get(null, function(items) {
      var allKeys = Object.keys(items);

      allKeys.forEach(element => {
          if (!(isNaN(element)) && (element != 0)) {
              if (!memberRoster.includes(Number(element))) {
                chrome.storage.local.remove(element);
              }
          }
      });       
  });



}