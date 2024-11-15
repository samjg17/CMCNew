import React, { CSSProperties, useState, MouseEvent, useEffect } from "react";
import CMCCardVisual from "./Card";
import { CMCGameState, CMCProps } from "../../shared/CardmasterGame";
import type { BoardProps } from "boardgame.io/react";
import { CanClickCard, OwnerOf } from "../../shared/LogicFunctions";
import { CardType, ClickType } from "../../shared/Constants";
import { CMCCard, CreateBasicCard } from "../../shared/CMCCard";
import { Ability, StackedAbility } from "../../shared/Abilities";
import { OtherPlayer } from "../../shared/Util";
import { FilteredMetadata } from "boardgame.io";
import { icons } from "./Icons";
import { DbFullDeck } from "../../server/DbTypes";
import Chat from "./Chat";
import GameOver from "./GameOver";
import HoverBigCard from "./HoverBigCard";

export function CMCBoard(props: CMCProps) {
  const [GameStarted, setGameStarted] = useState(false);
  const [Waiting, setWaiting] = useState(false);
  const [dbid, setdbid] = useState("");
  if (props.G.wait == false && !GameStarted) {
    setGameStarted(true);
  }
  if (!Waiting && !props.cpuopponent) {
    if (
      !GameStarted &&
      props.matchData !== undefined &&
      props.matchData[props.playerID || "0"].data !== undefined
    ) {
      // ready to start
      const matchdata: FilteredMetadata = props.matchData;

      props.moves.ready(
        props.playerID,
        matchdata[props.playerID || "0"].data.dbPlayerId
      );
      setdbid(matchdata[props.playerID || "0"].data.dbPlayerId);
      setWaiting(true);
    }
  } else {
    // set up vs cpu game
    
    // load your deck and send as a move
    useEffect(() => {
      fetch("/api/manage/player/getbyid/" + props.dbplayerid)
        .then((response) => response.json())
        .then((data) => {
          const dbplayer = data.player;
          fetch("/api/manage/decks/get/" + data.player.selecteddeck)
            .then((response) => response.json())
            .then((data) => {
              const fulldeck = data.decks as DbFullDeck;

              props.moves.cpu(
                props.playerID,
                props.dbplayerid,
                props.cpuopponent,
                fulldeck,
                dbplayer
              );
              setdbid(props.dbplayerid || "0");
              setGameStarted(true);
            });
        });
    }, []);
  }

  const [inspectMode, setInspectMode] = useState(false);
  const [inspectCard, setInspectCard] = useState(CreateBasicCard());
  const [clickableInspect, setclickableInspect] = useState(false);
  const [hoverCard, setHoverCard] = useState(CreateBasicCard());
  if (!GameStarted) {
    return <div>waiting for players</div>;
  }

  const state: CMCGameState = props.G;

  const endTurn = () => props.moves.passTurn();
  const endStage = () => props.moves.passStage();
  const cancel = () => {
    if (inspectMode) {
      setInspectMode(false);
    } else {
      props.moves.cancel(you);
    }
  };
  const inspect = () => {
    console.log("Go into inspect mode");
    // go into inspect mode.
    setInspectMode(true);
  };
  const clickInspectedAbility = (card: CMCCard, ability: Ability) => {
    console.log("clicked ability");
    console.log(ability);
    props.moves.activateAbility(card, ability, you);
    setInspectMode(false);
  };
  const clickCard = (card: CMCCard) => {
    console.log("Clicked " + card.name + " with guid " + card.guid);
    if (inspectMode) {
      //show big card on right.
      console.log("Inspecting " + card.name);
      setInspectCard(card);
      setInspectMode(false);
      setclickableInspect(OwnerOf(card, props.G) == you);
    } else {
      if (card.type == CardType.EMPTY) {
        props.moves.chooseSlot(card, you);
      } else if (
        card.type == CardType.MONSTER ||
        card.type == CardType.EFFECT ||
        card.type == CardType.PERSONA
      ) {
        props.moves.pickEntity(card, you);
      }
    }
  };
  const clickCardFromHand = (card: CMCCard) => {
    console.log("Clicked " + card.name + " with guid " + card.guid);
    if (inspectMode) {
      //show big card on right.
      console.log("Inspecting " + card.name);
      setInspectCard(card);
      setInspectMode(false);
      setclickableInspect(false);
    } else {
      props.moves.playCardFromHand(card, you);
    }
  };

  const hoverOnCard = (card: CMCCard | undefined) => {
    if (!card) {
      setHoverCard(CreateBasicCard());
    } else {
      const copy = JSON.parse(JSON.stringify(card));

      setHoverCard(copy);
    }
  };

  const flexStyle: CSSProperties = {
    display: "flex",
  };
  let currentPlayer = props.ctx.currentPlayer;
  let you = currentPlayer;

  let activePlayer = currentPlayer;
  if (props.ctx.activePlayers) {
    if ("0" in props.ctx.activePlayers) {
      activePlayer = "0";
    } else {
      activePlayer = "1";
    }
  }

  if (props.isMultiplayer && props.playerID != null) {
    you = props.playerID;
  } else {
    you = activePlayer;
  }

  let otherPlayer = you == "0" ? "1" : "0";
  

  if (props.ctx.gameover && props.ctx.gameover.winner) {
    return (
    <div> 
    <GameOver
        props = {props}
        winner = {props.ctx.gameover.winner}
        player = {you}
        dbid = {dbid}
      />
      </div>
    )
  } else {
    return (
      <div className="cmcboard">
        <div className="debug">
          stage:
          {props.ctx.activePlayers
            ? props.ctx.activePlayers[you]
              ? props.ctx.activePlayers[you]
              : props.ctx.activePlayers[OtherPlayer(you)]
            : ""}
          <br />
          player: {props.ctx.currentPlayer} you: {you}
          <br />
          inspect: {inspectMode ? "yes" : "no"}
          <br />
        </div>
        <div className="cmcBoard">
          <div className="playerBox">
            <div className="playerCardBox">
              <CMCCardVisual
                G={props.G}
                ctx={props.ctx}
                big={true}
                activeCard={false}
                player={props.G.playerData[otherPlayer]}
                hover={hoverOnCard}
                card={props.G.playerData[otherPlayer].persona}
                doClick={() =>
                  clickCard(props.G.playerData[otherPlayer].persona)
                }
                clickability={false}
                canClick={
                  inspectMode ||
                  CanClickCard(
                    props.G.playerData[otherPlayer].persona,
                    you,
                    ClickType.PERSONA,
                    props.ctx,
                    props.G
                  )
                }
                key={"player" + otherPlayer}
              />
            </div>
            <div className="locationBox">
              <CMCCardVisual
                G={props.G}
                ctx={props.ctx}
                big={true}
                activeCard={false}
                player={props.G.playerData[props.G.location.owner]}
                card={props.G.location}
                doClick={() => clickCard(props.G.location)}
                hover={hoverOnCard}
                canClick={
                  inspectMode ||
                  CanClickCard(
                    props.G.location,
                    you,
                    ClickType.LOCATION,
                    props.ctx,
                    props.G
                  )
                }
                key={"player" + otherPlayer}
              />
            </div>
            <div className="playerCardBox">
              <CMCCardVisual
                G={props.G}
                ctx={props.ctx}
                big={true}
                activeCard={false}
                player={props.G.playerData[you]}
                card={props.G.playerData[you].persona}
                hover={hoverOnCard}
                doClick={() => clickCard(props.G.playerData[you].persona)}
                canClick={
                  inspectMode ||
                  CanClickCard(
                    props.G.playerData[you].persona,
                    you,
                    ClickType.PERSONA,
                    props.ctx,
                    props.G
                  )
                }
                key={"player" + you}
              />
            </div>
          </div>
          <div className="cardRow">
            <div style={flexStyle}>
              {state.slots[otherPlayer].monsters.map(
                (card: CMCCard, index: number) => (
                  <CMCCardVisual
                    G={props.G}
                    ctx={props.ctx}
                    big={false}
                    hover={hoverOnCard}
                    activeCard={false}
                    player={props.G.playerData[otherPlayer]}
                    card={card}
                    doClick={() => clickCard(card)}
                    canClick={
                      inspectMode ||
                      CanClickCard(
                        card,
                        you,
                        ClickType.MONSTER,
                        props.ctx,
                        props.G
                      )
                    }
                    key={"0m" + index}
                  />
                )
              )}
            </div>
            <div style={flexStyle}>
              {state.slots[otherPlayer].effects.map(
                (card: CMCCard, index: number) => (
                  <CMCCardVisual
                    G={props.G}
                    ctx={props.ctx}
                    big={false}
                    hover={hoverOnCard}
                    activeCard={false}
                    player={props.G.playerData[otherPlayer]}
                    card={card}
                    doClick={() => clickCard(card)}
                    key={"0e" + index}
                    canClick={
                      inspectMode ||
                      CanClickCard(
                        card,
                        you,
                        ClickType.EFFECT,
                        props.ctx,
                        props.G
                      )
                    }
                  />
                )
              )}
            </div>
            <div style={flexStyle}>
              {state.slots[you].effects.map((card: CMCCard, index: number) => (
                <CMCCardVisual
                  G={props.G}
                  ctx={props.ctx}
                  big={false}
                  hover={hoverOnCard}
                  activeCard={false}
                  player={props.G.playerData[you]}
                  card={card}
                  doClick={() => clickCard(card)}
                  key={"1e" + index}
                  canClick={
                    inspectMode ||
                    CanClickCard(
                      card,
                      you,
                      ClickType.EFFECT,
                      props.ctx,
                      props.G
                    )
                  }
                />
              ))}
            </div>
            <div style={flexStyle}>
              {state.slots[you].monsters.map((card: CMCCard, index: number) => (
                <CMCCardVisual
                  G={props.G}
                  ctx={props.ctx}
                  big={false}
                  hover={hoverOnCard}
                  activeCard={false}
                  player={props.G.playerData[you]}
                  card={card}
                  doClick={() => clickCard(card)}
                  key={"1m" + index}
                  canClick={
                    inspectMode ||
                    CanClickCard(
                      card,
                      you,
                      ClickType.MONSTER,
                      props.ctx,
                      props.G
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div className="detailCardContainer">
            <div className="inspectCard">
              <CMCCardVisual
                G={props.G}
                ctx={props.ctx}
                card={inspectCard}
                lookingplayer={you}
                clickability={clickableInspect}
                owner={OwnerOf(inspectCard, props.G)}
                detail={true}
                doClick={(ability: Ability) => {
                  clickInspectedAbility(inspectCard, ability);
                }}
                canClick={false}
                big={true}
                activeCard={false}
                player={props.G.playerData[OwnerOf(inspectCard, props.G)]}
              />
              <div className="abilitytray">
                {props.G.abilityStack.map(
                  (stackedAbility: StackedAbility, index: number) => {
                    return (
                      <div
                        className="stackedAbility"
                        key={index + stackedAbility.card.guid}
                      >
                        <div className="stackedAbilityName">
                          {stackedAbility.ability.abilityName} :{" "}
                          {stackedAbility.ability.speed}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="controlbtns">
          {!props.isMultiplayer || activePlayer == you ? (
            <div>
              <button onClick={() => endTurn()}>END</button>
              <button onClick={() => endStage()}>NEXT</button>
              <button onClick={() => cancel()}>CANCEL</button>
              <button onClick={() => inspect()}>INSPECT</button>
            </div>
          ) : (
            ""
          )}
        </div>
        <div className="handcontainer">
          <div className="handspacer"></div>
          <div className="hand" style={flexStyle}>
            <div className="handspacerx"></div>
            {state.players[you].hand.map((card: CMCCard, index: number) => (
              <CMCCardVisual
                G={props.G}
                ctx={props.ctx}
                big={false}
                player={props.G.playerData[you]}
                card={card}
                hover={hoverOnCard}
                activeCard={
                  props.G.activeCard
                    ? props.G.activeCard.guid == card.guid
                    : false
                }
                key={you + "h" + index + "test"}
                doClick={() => clickCardFromHand(card)}
                canClick={
                  inspectMode ||
                  CanClickCard(card, you, ClickType.HAND, props.ctx, props.G)
                }
              />
            ))}
          </div>
        </div>

        <div className="gravecontainer">
          <div className="graveyard" style={flexStyle}>
            {state.playerData[you].graveyard.map(
              (card: CMCCard, index: number) => (
                <CMCCardVisual
                  G={props.G}
                  ctx={props.ctx}
                  big={false}
                  player={props.G.playerData[you]}
                  card={card}
                  hover={hoverOnCard}
                  activeCard={
                    props.G.activeCard
                      ? props.G.activeCard.guid == card.guid
                      : false
                  }
                  key={you + "h" + index + "test"}
                  doClick={() => clickCardFromHand(card)}
                  canClick={
                    inspectMode ||
                    CanClickCard(
                      card,
                      you,
                      ClickType.GRAVEYARD,
                      props.ctx,
                      props.G
                    )
                  }
                />
              )
            )}
          </div>
        </div>
        <HoverBigCard 
          props = {props}
          hoverCard = {hoverCard}
          otherPlayer = {otherPlayer}
           />
        <div className={"chatwindow"}>
          {props.showChat ? (
            <Chat
              onSend={this.props.sendChatMessage}
              messages={this.props.chatMessages}
            />
          ) : (
            <></>
          )}
        </div>
      </div>
    );
  }
}
function setDbPlayer(player: any) {
  throw new Error("Function not implemented.");
}
