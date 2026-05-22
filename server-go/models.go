package main

// models.go — MAXI model types for the Sports Statistics API server.
//
// These mirror the types defined in shared/sports.mxs. The server calls
// core.GetMaxiSchema on each struct to derive *core.MaxiTypeDef values,
// replacing the hand-written makeField() constructions in server.go.

// STeam mirrors the T:Team type.
type STeam struct {
	_       struct{} `maxi:"alias:T,name:Team"`
	ID      int      `maxi:"id,type:int,id"`
	Name    string   `maxi:"name,required"`
	City    string   `maxi:"city,required"`
	Founded int      `maxi:"founded,type:int"`
	Coach   string   `maxi:"coach,required"`
}

// SPlayer mirrors the P:Player type.
type SPlayer struct {
	_         struct{} `maxi:"alias:P,name:Player"`
	ID        int      `maxi:"id,type:int,id"`
	Name      string   `maxi:"name,required"`
	Position  string   `maxi:"position,type:enum[forward,midfielder,defender,goalkeeper]"`
	BirthYear int      `maxi:"birthYear,type:int"`
	Team      *STeam   `maxi:"team,type:T"`
}

// SPlayerStats mirrors the S:PlayerStats type.
type SPlayerStats struct {
	_             struct{} `maxi:"alias:S,name:PlayerStats"`
	Player        *SPlayer `maxi:"player,type:P"`
	Goals         int      `maxi:"goals,type:int,default:0"`
	Assists       int      `maxi:"assists,type:int,default:0"`
	MinutesPlayed int      `maxi:"minutesPlayed,type:int,default:0"`
}

// SGame mirrors the G:Game type.
type SGame struct {
	_         struct{} `maxi:"alias:G,name:Game"`
	ID        int      `maxi:"id,type:int,id"`
	HomeTeam  *STeam   `maxi:"homeTeam,type:T"`
	AwayTeam  *STeam   `maxi:"awayTeam,type:T"`
	Date      string   `maxi:"date,ann:date,required"`
	Status    string   `maxi:"status,type:enum[scheduled,live,finished,cancelled]"`
	HomeScore int      `maxi:"homeScore,type:int,default:0"`
	AwayScore int      `maxi:"awayScore,type:int,default:0"`
}

// SGameDetail mirrors the D:GameDetail type.
type SGameDetail struct {
	_           struct{}        `maxi:"alias:D,name:GameDetail"`
	GameID      int             `maxi:"gameId,type:int"`
	HomePlayers []*SPlayerStats `maxi:"homePlayers,type:S[]"`
	AwayPlayers []*SPlayerStats `maxi:"awayPlayers,type:S[]"`
}

// STransfer mirrors the X:Transfer type.
type STransfer struct {
	_        struct{}  `maxi:"alias:X,name:Transfer"`
	ID       int       `maxi:"id,type:int,id"`
	Player   *SPlayer  `maxi:"player,type:P"`
	FromTeam *STeam    `maxi:"fromTeam,type:T"`
	ToTeam   *STeam    `maxi:"toTeam,type:T"`
	Date     string    `maxi:"date,ann:date,required"`
	Fee      *float64  `maxi:"fee,type:decimal"`
}
