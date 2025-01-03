package main

import (
	"encoding/json"
	"fmt"
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
		json.Unmarshal(p, &data)
		// fmt.Println(string(data.Message.Name))

		payload, err := json.Marshal(data.Message)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("There are currently %d clients connected\n", len(server.memberClients))
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

		// if err := conn.WriteMessage(messageType, p); err != nil {
		// 	fmt.Println("Failed to Write to client")
		// 	log.Println(err)
		// 	return
		// }

	}
}

func (server *commServer) clientHandler(w http.ResponseWriter, r *http.Request) {

	upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
	}
	// fmt.Println()
	log.Printf("Client %s Connected", r.URL.Query().Get("token"))

	client := &memberClient{
		token:    r.URL.Query().Get("token"),
		socket:   ws,
		messages: make(chan []byte),
	}
	//check if client exists
	// if server.memberClients
	fmt.Println("Validate Client Here")

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

func setupRoutes(server *commServer) {
	http.HandleFunc("/", homePage)
	http.HandleFunc("/ws", server.clientHandler)
}

func main() {
	fmt.Println("Hello World")
	server := newCommServer()
	setupRoutes(server)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
