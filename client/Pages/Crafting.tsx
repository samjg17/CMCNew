import { useEffect, useState } from "react";
import { DbCompletion, DbCraftingMats } from "../../server/DbTypes";
import { DbPlayer } from "../../server/DbTypes";
import React from "react";
import { icons } from "../CMCComponents/Icons";
import { CreateBasicCard, GetCardPrototype } from "../../shared/CMCCard";
import CMCCardVisual from "../CMCComponents/Card";
import { CreateDefaultPlayer } from "../../shared/Player";
import crafting from "../../shared/data/crafting.json";
import { Link } from "react-router-dom";


const Craft = () => {
  const emptym: DbCraftingMats = {
    playerid: "",
    mats: [],
  };
  const emptyp: DbPlayer = {
    playerid: "",
    visualname: "",
    selecteddeck: "",
    username: "",
    authenticationcode: "",
  };
  const [DbPlayer, setDbPlayer] = useState("");
  const [Player, setPlayer] = useState(CreateDefaultPlayer(""));
  const [PlayerID, setPlayerID] = useState("");
  const [Mats, setMats] = useState(emptym);
  const [Word, setWord] = useState("");
  const [Card, setCard] = useState(CreateBasicCard());
  const [CardsGiven, setCardsGiven] = useState(["empty"]);
  const [Known, setKnown] = useState([""]);


  useEffect(() => {
    fetch("/api/manage/player/getsession")
      .then((response) => response.json())
      .then((data) => {
        if (data.playerid !== "") {
          setPlayerID(data.playerid);
          const playerid = data.playerid;
          fetch("/api/manage/mats/get/" + playerid)
            .then((response) => response.json())
            .then((data) => {
              setMats(data.mats);
              fetch("/api/manage/completions/get/" + playerid + "/craft")
                .then((response) => response.json())
                .then((data) => {
                  const knownrecipes: string[] = [];
                  for (const completion of data.completions) {
                    knownrecipes.push(
                      (completion as DbCompletion).completionname
                    );
                  }
                  console.dir(data);
                  setKnown(knownrecipes);
                });
            });
        }
      });
  }, []);

  function craft() {
    fetch("/api/manage/mats/craft/" + PlayerID + "/" + Word)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error(data.error);
        } else {
          console.dir(data);
          setCardsGiven(data.given);
          setWord("");
          if (data.type == "R") {
            if (!Known.includes(data.recipe)) Known.push(data.recipe);
          }
        }
      });
  }
  function addLetter(letter: string) {
    let succeed = true;
    Mats.mats.forEach((mat) => {
      if (mat.letter == letter) {
        if (mat.amount <= 0) {
          succeed = false;
          return;
        }
        mat.amount = mat.amount - 1;
      }
    });
    if (succeed) setWord(Word + letter);
  }

  function backspace() {
    if (Word.length == 0) {
      return;
    }
    const newletter = Word.slice(-1);
    let found = false;
    Mats.mats.forEach((mat) => {
      if (mat.letter == newletter) {
        mat.amount = mat.amount + 1;
        found = true;
      }
    });
    if (!found) {
      Mats.mats.push({ letter: newletter, amount: 1, playerid: PlayerID });
    }
    setWord(Word.slice(0, -1));
  }

  const nocards = (
    <CMCCardVisual
      card={Card}
      canClick={false}
      doClick={() => {}}
      activeCard={false}
      player={Player}
      big={true}
      detail={true}
    />
  );
  const cards = CardsGiven.map((cardid) => {
    console.log("Ccrd", cardid);
    return (
      <CMCCardVisual
        card={GetCardPrototype(cardid)}
        canClick={false}
        doClick={() => {}}
        activeCard={false}
        player={Player}
        big={true}
        detail={true}
      />
    );
  });

  const cardbox = (
    <div className="gotacard">
      <div className="gotcards">
        {CardsGiven.length != 0 && CardsGiven[0] != "" ? cards : nocards}
      </div>
    </div>
  );

  const entrybox = (
    <div className="wordentry">
      <div className="wordletters">
        {Word}_
        <button
          className="backspace"
          onClick={() => {
            backspace();
          }}
        >
          {icons.backspace}
        </button>
      </div>
    </div>
  );
  const known = (
    <div className="knownrecipes">
      <div className="recipe recipetitle">
        KNOWN
        <br /> RECIPES
      </div>
      {Known.map((recipe) => {
        return <div className="recipe recipetext">{recipe}</div>;
      })}
    </div>
  );
  const letterList = Object.keys(crafting.rewardrates);

  // Combine all available crafting letters with letters the player has into a single list
  const combinedMats = letterList.map((letter) => {
    const mat = Mats.mats.find((m) => m.letter === letter);
    return {
      letter: letter,
      amount: mat ? mat.amount : 0,
    };
  });

  const LetterBox = ({ mats, onClick }) => (
    <>
      {mats.map((mat) => (
        <div
          key={mat.letter}
          className="letter"
        >
          <button
            className="selectletter"
            onClick={() => onClick(mat.letter)}
            style={mat.amount > 0 ? { color: "#0f9015" } : { color: "darkgrey" }}
            disabled={mat.amount <= 0}
          >
            <div className="lettericon">
              {icons["letter" + mat.letter.toLowerCase()]}
            </div>
            <div className="amount">{mat.amount}</div>
          </button>
        </div>
      ))}
    </>
  );
  
  const letterbox = (
    <>
      {(() => {
        //Split the list of mats in half to render 2 rows
        //Done like this to account for more letters being added in the future
        const halfwayIndex = Math.ceil(combinedMats.length / 2);
        const firstHalf = combinedMats.slice(0, halfwayIndex);
        const secondHalf = combinedMats.slice(halfwayIndex);
  
        return (
          <>
          <div className="letterbox">
            <LetterBox mats={firstHalf} onClick={addLetter} />
            </div>
            <div className="letterbox">
            <LetterBox mats={secondHalf} onClick={addLetter} />
              <div key="cauldron" className="letter">
                <button
                  className="selectletter"
                  onClick={craft}
                >
                  <div className="lettericon">{icons.cauldron}</div>
                  <div className="amount">Craft!</div>
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );

  return (
    <div className="CraftingInterface">
      <div className="cardgoeshere">{cardbox}</div>
      <div className="entrybox">{entrybox}</div>
      <div className="letters">{letterbox}</div>
      <div className="known">{known}</div>
      <Link style={{"padding": "10px"}} to="/home">Back to home</Link>
    </div>
  );
};
export default Craft;
