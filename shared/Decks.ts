import { PlayerIDs } from "../shared/Constants";

import { CMCCard, GetCardPrototype } from "./CMCCard";

interface PlayerDecks {
  "0": CMCCard[];
  "1": CMCCard[];
}
function ParseDecks(decksJson: any): any {
  let decks: PlayerDecks = {
    "0": [],
    "1": [],
  };
  PlayerIDs.forEach((id) => {
    const newDeck: CMCCard[] = [];
    decksJson[id].cards.forEach(function (card: any) {
      for (let i = 0; i < card.count; i++) {
        newDeck.push(GetCardPrototype(card.id));
      }
    });

    decks[id] = newDeck;
  });
  return decks;
}

function CreateDebugSetupData() {
  const setupData = {
    decks: {
      "0": {
        persona: "debugpersona",
        cards: [
          { id: "debugslime", count: 10 },

          { id: "debugspell", count: 10 },

          { id: "debugloc", count: 10 },

          { id: "debuggen", count: 10 },
        ],
      },
      "1": {
        persona: "debugpersona",
        cards: [
          { id: "debugslime", count: 10 },

          { id: "debugspell", count: 10 },

          { id: "debugloc", count: 10 },

          { id: "debuggen", count: 10 },
        ],
      },
    },
  };
  return setupData;
}

export { PlayerDecks, ParseDecks, CreateDebugSetupData };
