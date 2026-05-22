package main

// models.go — MAXI model types for the Sports Statistics API client.
//
// These mirror the types defined in shared/sports.mxs and can be used with
// api.ParseMaxiAs() / api.ParseMaxiAutoAs() for typed record hydration.
//
// Usage:
//
//	res, err := api.ParseMaxiAs(text, map[string]reflect.Type{
//	    "T": reflect.TypeOf(Team{}),
//	    "P": reflect.TypeOf(Player{}),
//	}, parseOpts())

// Team mirrors the T:Team type.
type Team struct {
	_       struct{} `maxi:"alias:T,name:Team"`
	ID      int      `maxi:"id,type:int,id"`
	Name    string   `maxi:"name,required"`
	City    string   `maxi:"city,required"`
	Founded int      `maxi:"founded,type:int"`
	Coach   string   `maxi:"coach,required"`
}

// Player mirrors the P:Player type.
type Player struct {
	_         struct{} `maxi:"alias:P,name:Player"`
	ID        int      `maxi:"id,type:int,id"`
	Name      string   `maxi:"name,required"`
	Position  string   `maxi:"position,type:enum[forward,midfielder,defender,goalkeeper]"`
	BirthYear int      `maxi:"birthYear,type:int"`
	Team      *Team    `maxi:"team,type:T"`
}

// PlayerStats mirrors the S:PlayerStats type.
type PlayerStats struct {
	_             struct{} `maxi:"alias:S,name:PlayerStats"`
	Player        *Player  `maxi:"player,type:P"`
	Goals         int      `maxi:"goals,type:int,default:0"`
	Assists       int      `maxi:"assists,type:int,default:0"`
	MinutesPlayed int      `maxi:"minutesPlayed,type:int,default:0"`
}

// Game mirrors the G:Game type.
type Game struct {
	_         struct{} `maxi:"alias:G,name:Game"`
	ID        int      `maxi:"id,type:int,id"`
	HomeTeam  *Team    `maxi:"homeTeam,type:T"`
	AwayTeam  *Team    `maxi:"awayTeam,type:T"`
	Date      string   `maxi:"date,ann:date,required"`
	Status    string   `maxi:"status,type:enum[scheduled,live,finished,cancelled]"`
	HomeScore int      `maxi:"homeScore,type:int,default:0"`
	AwayScore int      `maxi:"awayScore,type:int,default:0"`
}

// GameDetail mirrors the D:GameDetail type.
type GameDetail struct {
	_           struct{}       `maxi:"alias:D,name:GameDetail"`
	GameID      int            `maxi:"gameId,type:int"`
	HomePlayers []*PlayerStats `maxi:"homePlayers,type:S[]"`
	AwayPlayers []*PlayerStats `maxi:"awayPlayers,type:S[]"`
}

// Transfer mirrors the X:Transfer type.
type Transfer struct {
	_        struct{}  `maxi:"alias:X,name:Transfer"`
	ID       int       `maxi:"id,type:int,id"`
	Player   *Player   `maxi:"player,type:P"`
	FromTeam *Team     `maxi:"fromTeam,type:T"`
	ToTeam   *Team     `maxi:"toTeam,type:T"`
	Date     string    `maxi:"date,ann:date,required"`
	Fee      *float64  `maxi:"fee,type:decimal"`
}
