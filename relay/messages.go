package main

type MessageUpdate struct {
	SourceToken string
	Message     FactionMemberUpdate
}

type FactionMemberUpdate struct {
	Id            int                     `json:"id"`
	Name          string                  `json:"name"`
	Position      string                  `json:"position"`
	Level         int                     `json:"level"`
	DaysInFaction int                     `json:"days_in_faction"`
	LastAction    FactionMemberLastAction `json:"last_action"`

	Status        FactionMemberStatus `json:"status"`
	Life          FactionMemberLife   `json:"life"`
	ReviveSetting string              `json:"revive_setting"`
	IsRevivable   bool                `json:"is_revivable"`
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
