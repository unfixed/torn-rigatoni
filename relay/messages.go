package main

type MessageUpdate struct {
	SourceToken string                `json:"SourceToken"`
	Message     []FactionMemberUpdate `json:"Message"`
}

type FactionMemberUpdate struct {
	Id            int                     `json:"id"`
	Name          string                  `json:"name"`
	Timestamp     int64                   `json:"timestamp"`
	Position      string                  `json:"position"`
	Level         int                     `json:"level"`
	DaysInFaction int                     `json:"days_in_faction"`
	LastAction    FactionMemberLastAction `json:"last_action"`

	Status        FactionMemberStatus `json:"status"`
	Life          FactionMemberLife   `json:"life"`
	ReviveSetting string              `json:"revive_setting"`
	IsRevivable   bool                `json:"is_revivable"`
	IsTarget      bool                `json:"is_target"`
}
type FactionMemberLastAction struct {
	Status    string `json:"status"`
	Timestamp int    `json:"timestamp"`
	Relative  string `json:"relative"`
}
type FactionMemberStatus struct {
	Description string `json:"description"`
	Details     string `json:"details"`
	State       string `json:"state"`
	Until       int    `json:"until"`
}
type FactionMemberLife struct {
	Current int `json:"current"`
	Maximum int `json:"maximum"`
}

type ClientOffset struct {
	NumberOfClients int
	Index           int
}
