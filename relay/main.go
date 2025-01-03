package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"slices"
	"sync"

	"github.com/gorilla/websocket"
)

type commServer struct {
	syncMutex     sync.Mutex
	memberClients map[*memberClient]struct{}
}

func newCommServer() *commServer {
	server := &commServer{
		memberClients: make(map[*memberClient]struct{}),
	}

	return server
}

func (server *commServer) addClient(client *memberClient) {
	server.syncMutex.Lock()
	server.memberClients[client] = struct{}{}
	server.syncMutex.Unlock()
}

func (server *commServer) removeClient(client *memberClient) {
	server.syncMutex.Lock()
	delete(server.memberClients, client)
	server.syncMutex.Unlock()
}

type memberClient struct {
	token     string
	socket    *websocket.Conn
	messages  chan []byte
	closeSlow func()
}

var upgrader = websocket.Upgrader{
	// websocket.
	ReadBufferSize:  1048576,
	WriteBufferSize: 1048576,
}

func homePage(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Home Page")
}

func (server *commServer) reader(conn *websocket.Conn) {
	for {
		// read in a message
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		// print out that message for clarity
		fmt.Printf("messageRecieved:    %s\n", string(p))

		if string(p) == "keepalive" {
			continue
		}

		var data MessageUpdate
		err_unmarshal := json.Unmarshal(p, &data)
		if err_unmarshal != nil {
			fmt.Println("Error:", err_unmarshal)
		}

		payload, err := json.Marshal(data.Message)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("There are currently %d clients connected\n", len(server.memberClients))
		fmt.Println(string(payload))
		for client := range server.memberClients {
			if client.token == data.SourceToken {
				fmt.Println("update was from self")
				continue
			}
			if err := client.socket.WriteMessage(messageType, payload); err != nil {
				// log.Printf("client with token %s had an error when trying to send message.", client.token)
				log.Printf("client %s: %s", client.token, err)
				server.removeClient(client)
			}

		}

	}
}

func (server *commServer) clientHandler(w http.ResponseWriter, r *http.Request) {

	token := string(r.URL.Query().Get("token"))

	if _, ok := ApprovedTokens[token]; !ok {
		if !(validateClientToken(token)) {
			fmt.Println("Failed to ValidateClientToken!")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
	}

	upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
	}

	log.Printf("Client %+v Connected", token)

	client := &memberClient{
		token:    token,
		socket:   ws,
		messages: make(chan []byte),
	}

	keys := make([]string, 0, len(server.memberClients))
	for key := range server.memberClients {
		keys = append(keys, key.token)
	}
	if slices.Contains(keys, client.token) {
		for key := range server.memberClients {
			if key.token == client.token {
				server.removeClient(key)
			}
		}
	}
	server.addClient(client)

	server.reader(ws)

}

func validateClientToken(token string) bool {

	URL := fmt.Sprintf("https://api.torn.com/v2/user?key=%s", token)
	response, err_getUrl := http.Get(URL)
	if err_getUrl != nil {
		log.Println(err_getUrl)
		return false
	}

	responseBody, err_read_responseBody := io.ReadAll(response.Body)
	if err_read_responseBody != nil {
		log.Println(err_read_responseBody)
		return false
	}

	var data TornPlayer
	err_unmarshal := json.Unmarshal(responseBody, &data)
	if err_unmarshal != nil {
		log.Println(err_unmarshal)
		return false
	}

	return data.Faction.FactionID == 46708

}

func setupRoutes(server *commServer) {
	http.HandleFunc("/", homePage)
	http.HandleFunc("/ws", server.clientHandler)
}

var ApprovedTokens map[string]struct{}

func main() {
	fmt.Println("Hello World")
	server := newCommServer()
	setupRoutes(server)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
