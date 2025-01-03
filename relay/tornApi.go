package main

type TornPlayer struct {
	Faction TornPlayerFaction `json:"faction"`
}

type TornPlayerFaction struct {
	FactionID int `json:"faction_id"`
}
