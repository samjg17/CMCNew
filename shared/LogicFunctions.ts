import { Ctx } from "boardgame.io";
import { CMCGameState } from "./CardmasterGame";
import {
  CMCCard,
  CMCEffectCard,
  CMCEntityCard,
  CMCLocationCard,
  CMCMonsterCard,
  CMCPersonaCard,
  CreateBasicCard,
  GetModifiedStatCard,
} from "./CMCCard";
import { ClickType, CardType, Stages, PlayerIDs } from "./Constants";

import * as CardFunctions from "./CardFunctions";
import { CMCPlayer } from "./Player";
import { rule } from "postcss";

import { current } from "immer";
import {
  Random,
  RandomAPI,
} from "boardgame.io/dist/types/src/plugins/random/random";
import { GetActivePlayer, GetActiveStage, OtherPlayer } from "./Util";
import { CanActivateAbility, TriggerCard, TriggerNames } from "./Abilities";
import { EventsAPI } from "boardgame.io/dist/types/src/plugins/plugin-events";
import { AbilityFunctionArgs } from "./CardFunctions";

// adds a card from deck to hand
function DrawCard(
  playerId: string,
  cardcount: number,
  G: CMCGameState,
  ctx: Ctx,
  random: RandomAPI,
  events: EventsAPI
): boolean {
  if (G.secret.decks[playerId].length < cardcount) {
    //get milled idiot
    return false;
  }
  for (let i = 0; i < cardcount; i++) {
    const card = G.secret.decks[playerId].pop();
    G.players[playerId].hand.push(card);

    TriggerCard(TriggerNames.DRAW, ctx, card, G, random, events);
  }

  return true;
}

// adds resource (eg mana)
function PlayerAddResource(playerid: string, resource: any, G: CMCGameState) {
  let player: CMCPlayer = G.playerData[playerid];
  for (const check in resource) {
    for (const sub in resource[check]) {
      G.playerData[playerid].resources[check][sub] += resource[check][sub];
    }
  }
}

// reduces resource.
function PlayerPay(
  playerid: string,
  cost: any,
  G: CMCGameState,
  random?: RandomAPI,
  events?: EventsAPI
) {
  const fullplayer: CMCPlayer = G.playerData[playerid];

  if (!fullplayer) {
    return false;
  }
  for (const check in cost) {
    for (const sub in cost[check]) {
      if (fullplayer.resources[check][sub] < cost[check[sub]]) {
        return false;
      }
      fullplayer.resources[check][sub] =
        fullplayer.resources[check][sub] - cost[check][sub];
    }
  }
  return true;
}

interface DamageResult {
  card: CMCCard;
  damage: number;
  overage: number; // damage - health, except in certain circumstances
  destroyed: boolean;
}

// check if any card needs updating, eg: is destroyed
function CardScan(
  G: CMCGameState,
  random: RandomAPI,
  ctx: Ctx,
  events: EventsAPI
): void {
  for (const slotplayer in G.slots) {
    for (const subplayer in G.slots[slotplayer]) {
      for (const [index, card] of G.slots[slotplayer][subplayer].entries()) {
        if (card.type == CardType.EMPTY) {
          continue;
        }
        const entity = card as CMCEntityCard;

        // is it dead
        if (entity.destroyed) {
          TriggerCard(TriggerNames.ON_DESTROY, ctx, entity, G, random, events);
          // add monster to graveyard
          AddToGraveyard(entity, G);
          //new slot
          G.slots[slotplayer][subplayer][index] = CreateBasicCard(
            GenerateRandomGuid(random)
          );
        }
      }
    }
  }
  // scan for hand and graveyard

  for (const slotplayer in G.players) {
    const hand: CMCCard[] = G.players[slotplayer].hand;
    G.players[slotplayer].hand = hand.filter((crd, i) => !crd.obliterated);
  }
  for (const slotplayer in G.playerData) {
    const grave: CMCCard[] = G.playerData[slotplayer].grave;
    G.playerData[slotplayer].grave = grave.filter((crd, i) => !crd.obliterated);
  }
}

function AddToGraveyard(card: CMCCard, G: CMCGameState) {
  const owner = OwnerOf(card, G);

  G.playerData[owner].graveyard.push(card);
}
// generate a new guid
function GenerateRandomGuid(random: RandomAPI) {
  let guid: string = "[";
  for (let num = 0; num <= 100; num++) {
    guid += random.D20() + " ";
  }
  guid += "]";
  return guid;
}

function GainLife(
  card: CMCMonsterCard | CMCPersonaCard,
  amount: number,
  G: CMCGameState
) {
  if ("life" in card) {
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, innerCard] of G.slots[slotplayer][
          subplayer
        ].entries()) {
          if (card.guid == innerCard.guid) {
            G.slots[slotplayer][subplayer][index].life += amount;
            if (G.slots[slotplayer][subplayer][index].life <= 0) {
              G.slots[slotplayer][subplayer][index].destroyed = true;
            }
          }
        }
      }
    }
  }
}

function GainTemporaryStats(
  card: CMCMonsterCard | CMCPersonaCard,
  lifeAmount: number,
  attackAmount: number,
  G: CMCGameState
) {
  if (lifeAmount != 0 && "life" in card) {
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, innerCard] of G.slots[slotplayer][
          subplayer
        ].entries()) {
          if (card.guid == innerCard.guid) {
            G.slots[slotplayer][subplayer][index].temporaryLife += lifeAmount;
          }
        }
      }
    }
  }
  //Loop done twice instead of once to account for the chance of there being a card variants which
  //has life but not attack such as giving temp life to a persona
  if (attackAmount != 0 && "attack" in card) {
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, innerCard] of G.slots[slotplayer][
          subplayer
        ].entries()) {
          if (card.guid == innerCard.guid) {
            G.slots[slotplayer][subplayer][index].temporaryAttack +=
              attackAmount;
          }
        }
      }
    }
  }
}

// deal damage. source is used for triggers of various kinds.
function DealDamage(
  damagee: CMCMonsterCard | CMCPersonaCard,
  source: CMCCard,
  amount: number,
  G: CMCGameState
): DamageResult {
  if ("life" in damagee) {
    const damageResult: DamageResult = {
      card: damagee,
      damage: 0,
      overage: 0,
      destroyed: false,
    };
    damageResult.damage = amount;
    damageResult.overage = amount - (damagee.life + damagee.temporaryLife);
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, card] of G.slots[slotplayer][subplayer].entries()) {
          if (card.guid == damagee.guid) {
            if (amount > G.slots[slotplayer][subplayer][index].temporaryLife) {
              G.slots[slotplayer][subplayer][index].life -=
                amount - G.slots[slotplayer][subplayer][index].temporaryLife;
              G.slots[slotplayer][subplayer][index].temporaryLife = 0;
              if (G.slots[slotplayer][subplayer][index].life <= 0) {
                G.slots[slotplayer][subplayer][index].destroyed = true;
                damageResult.destroyed = true;
              }
            } else {
              G.slots[slotplayer][subplayer][index].temporaryLife -= amount;
            }
          }
        }
      }
    }

    return damageResult;
  } else {
    const damageResult: DamageResult = {
      card: damagee,
      damage: 0,
      overage: 0,
      destroyed: false,
    };
    damageResult.damage = amount;
    G.playerData[damagee.playerID].resources.intrinsic.health -= amount;
    return damageResult;
  }
}

// function to take a card object and apply it to an in game slot.
function PlaceCard(
  card: CMCCard,
  slot: CMCCard,
  playerID: string,
  G: CMCGameState
): boolean {
  let subplayerfound = "";
  let subrowfound = -1;
  let slotplayerfound = "";

  if (card.type == CardType.LOCATION) {
    if (G.location.owner != "") {
      AddToGraveyard(G.location, G);
    }
    G.location = {
      ...card,

      owner: playerID,
    };

    return true;
  } else {
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, subrow] of G.slots[slotplayer][
          subplayer
        ].entries()) {
          const foundCard: CMCCard = subrow;
          if (subrow.guid == slot.guid) {
            subplayerfound = subplayer;
            subrowfound = index;
            slotplayerfound = slotplayer;
          }
        }
      }
    }

    if (subrowfound == -1 || subplayerfound == "" || slotplayerfound == "") {
      return false;
    }

    G.slots[slotplayerfound][subplayerfound][subrowfound] = card;

    return true;
  }
}

function IsInHand(card: CMCCard, playerID: string, G: CMCGameState) {
  let found = false;
  let hand: CMCCard[] = G.players[playerID].hand;
  hand.forEach((crd, idx) => {
    if (crd.guid == card.guid) {
      found = true;
    }
  });

  return found;
}

//remove card from hand, always do it after the card goes where it needs to (such as graveyard, play field)
function RemoveFromHand(
  card: CMCCard,
  playerID: string,
  G: CMCGameState
): boolean {
  let subplayerfound = "";
  let subrowfound = -1;
  let slotplayerfound = "";

  let found = IsInHand(card, playerID, G);
  let hand: CMCCard[] = G.players[playerID].hand;

  if (!found) {
    return false;
  }

  G.players[playerID].hand = hand.filter((crd, i) => crd.guid != card.guid);
  return true;
}

// standard play entity function, player pays cost and card moves from hand to slot
function PlayEntity(
  card: CMCCard,
  slot: CMCCard,
  playerID: string,
  G: CMCGameState,
  ctx: Ctx,
  random: RandomAPI,
  events: EventsAPI
): CMCGameState | boolean {
  let found = false;
  let hand: CMCCard[] = G.players[playerID].hand;
  hand.forEach((crd, idx) => {
    if (crd.guid == card.guid) {
      found = true;
    }
  });

  if (!found) {
    console.error("cannot play entity due to not found");
    return false;
  }
  const args: AbilityFunctionArgs = {
    card: card,
    cardowner: playerID,
    G: G,
    ctx: ctx,
    random: random,
    events: events,
    target: undefined,
    dry: false,
  };
  let success_pay = CardFunctions[card.costFunction](args);

  if (!success_pay || success_pay.length == 0) {
    console.error("cannot play entity due to price");
    return false;
  }

  if (!PlaceCard(card, slot, playerID, G)) {
    console.error("cannot play entity due placement error");
    return false;
  }

  if (!RemoveFromHand(card, playerID, G)) {
    console.error("cannot remove from hand");
    return false;
  }
  TriggerCard(TriggerNames.ON_PLAY, ctx, card, G, random, events);
  return G;
}

// determine ownerof card
function OwnerOf(card: CMCCard, G: CMCGameState) {
  for (const slotplayer in G.slots) {
    for (const subplayer in G.slots[slotplayer]) {
      for (const subrow of G.slots[slotplayer][subplayer]) {
        const slot: CMCCard = subrow;
        if (slot.guid === card.guid) {
          return slotplayer;
        }
      }
    }
  }
  for (const slotplayer in G.players) {
    const hand: CMCCard[] = G.players[slotplayer].hand;
    let found: boolean = false;
    hand.forEach((handcard, _idx) => {
      console.log(card.guid + " vs " + handcard.guid);
      if (card.guid == handcard.guid) {
        found = true;
        return slotplayer;
      }
    });
    if (found) {
      return slotplayer;
    }
  }
  // check persona and graveyard
  for (const playnumber in PlayerIDs) {
    const player: CMCPlayer = G.playerData[playnumber];
    if (player.persona.guid == card.guid) {
      return playnumber;
    }
    let found = false;
    player.graveyard.forEach((gcard, index) => {
      if (gcard.guid == card.guid) {
        found = true;
      }
    });
    if (found) {
      return playnumber;
    }
  }
  // check who played location
  if (card.type == CardType.LOCATION) {
    const actualLocation = G.location;
    if (card.guid == actualLocation.guid && actualLocation.owner != "") {
      return actualLocation.owner;
    }
  }
  return "-1";
}

// function run on all cards to determine clickability and legal moves
function CanClickCard(
  card: CMCCard,
  playerId: string,
  clickType: ClickType,
  ctx: Ctx,
  G: CMCGameState,
  random?: RandomAPI,
  events?: EventsAPI
): boolean {
  // inactive player cant click a darn thing
  if (playerId != GetActivePlayer(ctx)) {
    return false;
  }
  // is there an active ability?  If so, check targeting
  if (G.activeAbility) {
    if (!G.activeCard) {
      return false;
    }

    if (GetActiveStage(ctx) != Stages.pickAbilityTarget) {
      return false;
    }
    if (
      !CanActivateAbility(
        G.activeCard,
        G.activeAbility,
        G,
        ctx,
        random,
        events,

        card
      )
    ) {
      return false;
    }

    return true;
  }
  let cardOwner = OwnerOf(card, G);
  let currentPlayer = ctx.currentPlayer;

  // are you the active player
  const activePlayer = GetActivePlayer(ctx);

  if (activePlayer != playerId) {
    // only the active player can act
    return false;
  }

  let stage = GetActiveStage(ctx);

  if (clickType == ClickType.HAND) {
    // are we in play phase or combat phase and is it that player's turn
    if (activePlayer === currentPlayer) {
      if (!["play", "combat", Stages.discardCard].includes(stage)) {
        return false;
      }
    } else {
      // Are we in the resolve, respond, combat defense
      if (
        !["resolve", "respond", "defense", Stages.discardCard].includes(stage)
      ) {
        return false;
      }
    }
    // if we are discarding, then you can click anything in your hand
    if (stage == Stages.discardCard) {
      return true;
    }
    // if it's not a spell, you can only play it in play,

    if (card.type != CardType.SPELL && stage != "play") {
      return false;
    }

    // so! can you play it??
    const args: AbilityFunctionArgs = {
      card: card,
      cardowner: cardOwner,
      G: G,
      ctx: ctx,
      random: random,
      events: events,
      target: undefined,
      dry: true,
    };
    const costresult = CardFunctions[card.costFunction](args);

    if (!costresult || costresult.length == 0) {
      return false;
    }
    return true;
  } else if (
    clickType == ClickType.MONSTER ||
    clickType == ClickType.EFFECT ||
    clickType == ClickType.PERSONA ||
    clickType == ClickType.GRAVEYARD
  ) {
    // case one: you are playing an entity card from your hand and are selecting the slot.
    if (stage == Stages.pickSlot) {
      if (card.type != CardType.EMPTY) {
        return false; // can only pick slots
      }
      if (!G.activeCard) {
        return false; // you aren't playing a card
      }

      if (![CardType.EFFECT, CardType.MONSTER].includes(G.activeCard.type)) {
        return false; // only effects and monsters go into slots
      }

      if (OwnerOf(G.activeCard, G) != cardOwner) {
        // the owner of the active card is different than the slot owner
        return false;
      }
      if (activePlayer != currentPlayer) {
        // you arent the active player
        return false;
      }
      if (activePlayer != cardOwner) {
        // you aren't the owner
        return false;
      }
      const args: AbilityFunctionArgs = {
        card: card,
        cardowner: cardOwner,
        G: G,
        ctx: ctx,
        random: random,
        events: events,
        target: undefined,
        dry: true,
      };
      const result = CardFunctions[G.activeCard.costFunction](args);
      if (!result || result.length == 0) {
        // cant afford this card?
        return false;
      }
      if (
        (G.activeCard.type == CardType.EFFECT &&
          clickType != ClickType.EFFECT) ||
        (G.activeCard.type == CardType.MONSTER &&
          clickType != ClickType.MONSTER)
      ) {
        // slot is not hte same kind of card
        return false;
      }

      return true;
    } else if (stage == Stages.combat) {
      // picking attackers
      if (card.type != CardType.MONSTER) {
        return false; // can only pick monsters
      }
      if (OwnerOf(card, G) != activePlayer) {
        // the owner of the active card is different than the monster owner
        return false;
      }
      const monster = card as CMCMonsterCard;
      if (monster.dizzy || monster.destroyed) {
        // cant attack when dizzy or destroyed
        return false;
      }
      // is the monster already attacking?
      if (!G.combat) {
        return false;
      }
      for (const combatant of G.combat.targets) {
        if (combatant.attacker.guid == monster.guid) {
          return false;
        }
      }
      //todo: is the monster capaable of attacking?

      return true;
    } else if (stage == Stages.defense) {
      // picking attacking monster
      if (card.type != CardType.MONSTER) {
        return false; // can only pick monsters
      }
      if (OwnerOf(card, G) == activePlayer) {
        // you cant attack yourself
        return false;
      }
      const monster = card as CMCMonsterCard;

      if (!G.combat) {
        return false;
      }
      //todo: is the monster capaable of defending?

      // is the monster attacking?
      for (const combatant of G.combat.targets) {
        if (combatant.attacker.guid == monster.guid) {
          if (combatant.locked) {
            // monster is locked on it's current target
            return false;
          }
        }
      }
      return true;
    } else if (stage == Stages.pickCombatTarget) {
      // picking defending monster
      if (card.type != CardType.MONSTER && card.type != CardType.PERSONA) {
        return false; // can only pick monsters or  players
      }
      if (OwnerOf(card, G) == activePlayer) {
        // you cant attack yourself
        return false;
      }
      const monster = card as CMCMonsterCard | CMCPersonaCard;

      if (!G.combat) {
        return false;
      }
      //todo: is the monster capable of defending?

      // is the monster already defending?
      for (const combatant of G.combat.targets) {
        if (combatant.defender && combatant.defender.guid == monster.guid) {
          return false;
        }
      }
      return true;
    } else if (stage == Stages.pickCombatDefense) {
      // picking defending monster
      if (card.type != CardType.MONSTER) {
        return false; // can only pick monsters
      }
      if (OwnerOf(card, G) != activePlayer) {
        // you cant defend with oponent's monsters
        return false;
      }
      const monster = card as CMCMonsterCard;

      if (!G.combat) {
        return false;
      }
      //todo: is the monster capable of defending?

      // is the monster already defending?
      for (const combatant of G.combat.targets) {
        if (combatant.defender && combatant.defender.guid == monster.guid) {
          return false;
        }
      }
      return true;
    } else if (stage == Stages.sacrifice) {
      if (clickType == ClickType.PERSONA || clickType == ClickType.GRAVEYARD) {
        return false;
      }
      if (card.type == CardType.EMPTY) {
        return false;
      }
      if (OwnerOf(card, G) != playerId) {
        return false;
      }

      return true;
    }
  } else if ((clickType = ClickType.LOCATION)) {
    return false;
  }

  return false;
}

// reset the selected cards and stages
function resetActive(G: CMCGameState) {
  G.activeAbility = undefined;
  G.activeCard = undefined;
}
// reset combat at end of turn
function resetCombat(G: CMCGameState) {
  G.combat = undefined;
  G.resolution = undefined;
}

// update player data with secret info such as deck size
function CheckState(G: CMCGameState) {
  if (!G.gameStarted) {
    console.log("Game not started yet.");
    return;
  }
  for (const playerid in PlayerIDs) {
    // check player health
    const player: CMCPlayer = G.playerData[playerid];
    if (player.resources.intrinsic.health <= 0) {
      console.log("player lost due to health");
      G.winner = OtherPlayer(playerid);
    }
    // set player deck values for visual reasons
    player.currentDeck = G.secret.decks[playerid].length;
    player.currentGrave = G.playerData[playerid].graveyard.length;
    player.currentHand = G.players[playerid].hand.length;
  }
}
function IsMonster(card: CMCCard): card is CMCMonsterCard {
  return (card as CMCMonsterCard).life !== undefined;
}
function IsEffect(card: CMCCard): card is CMCMonsterCard {
  return (card as CMCEffectCard).status !== undefined;
}
function IsPersona(card: CMCCard): card is CMCPersonaCard {
  return (card as CMCPersonaCard).playerID !== undefined;
}

function CanDiscard(
  playerID: string,
  G: CMCGameState,
  ctx: Ctx,
  card?: CMCCard
) {
  if (G.players[playerID].hand.length <= 0) {
    return false;
  }
  if (card) {
    return IsInHand(card, playerID, G);
  }
  return true;
}

function ForceDiscard(
  chooseable: boolean,
  playerId: string,
  G: CMCGameState,
  ctx: Ctx,
  random: RandomAPI,
  events: EventsAPI
) {
  if (!CanDiscard(playerId, G, ctx)) {
    return false;
  }
  if (!chooseable) {
    //discard at random
    const card: CMCCard =
      G.players[playerId].hand[random.Die(G.players[playerId].hand.length) - 1];
    return Discard(card, playerId, G, ctx);
  } else {
    G.returnStage.push(Stages.resolve);
    events.setStage(Stages.discardCard);
  }
}

function Discard(
  card: CMCCard,
  playerId: string,
  G: CMCGameState,
  ctx: Ctx
): boolean {
  if (!CanDiscard(playerId, G, ctx, card)) {
    return false;
  }
  // has to add first because otherwise it's 'floating' with no way to tell who owns it.
  AddToGraveyard(card, G);
  if (!RemoveFromHand(card, playerId, G)) {
    return false;
  }

  return true;
}
function Sacrifice(
  card: CMCCard,
  G: CMCGameState,
  ctx: Ctx,
  random: RandomAPI,
  events: EventsAPI
) {
  if (GetActivePlayer(ctx) != OwnerOf(card, G)) {
    return false;
  }
  if (![CardType.EFFECT, CardType.MONSTER].includes(card.type)) {
    return false;
  }
  const modcard = GetModifiedStatCard(card, G, ctx);
  PlayerAddResource(OwnerOf(card, G), modcard.sac, G);

  for (const slotplayer in G.slots) {
    for (const subplayer in G.slots[slotplayer]) {
      for (const [index, slotcard] of G.slots[slotplayer][
        subplayer
      ].entries()) {
        if (slotcard.guid == card.guid) {
          G.slots[slotplayer][subplayer][index].destroyed = true;
        }
      }
    }
  }
  CardScan(G, random, ctx, events);
  return true;
}

function AllCards(G: CMCGameState) {
  const cards = {
    grave: [] as CMCCard[],
    hand: [] as CMCCard[],
    loc: [] as CMCCard[],
    persona: [] as CMCPersonaCard[],
    field: [] as CMCEntityCard[],
    all: [] as CMCCard[],
    allinplay: [] as CMCCard[],
    monsters: [] as CMCMonsterCard[],
    effects: [] as CMCEffectCard[],
  };
  for (const slotplayer in G.slots) {
    for (const subplayer in G.slots[slotplayer]) {
      for (const subrow of G.slots[slotplayer][subplayer]) {
        const card: CMCCard = subrow;
        cards.field.push(card as CMCEntityCard);
        cards.all.push(card);
        cards.allinplay.push(card);
        cards[subplayer].push(card);
      }
    }
  }
  if (!G.playerData) {
    console.dir(current(G));
  }
  cards.loc.push(G.location);
  cards.persona.push(G.playerData[0].persona);
  cards.persona.push(G.playerData[1].persona);
  cards.hand.push(...G.players[0].hand);
  cards.hand.push(...G.players[1].hand);
  cards.grave.push(...G.playerData[1].graveyard);
  cards.grave.push(...G.playerData[0].graveyard);

  cards.all.push(G.location);
  if (!G.playerData) {
    console.dir(current(G));
  }
  cards.all.push(G.playerData[0].persona);
  cards.all.push(G.playerData[1].persona);
  cards.all.push(...G.players[0].hand);
  cards.all.push(...G.players[1].hand);
  cards.all.push(...G.playerData[1].graveyard);
  cards.all.push(...G.playerData[0].graveyard);

  cards.allinplay.push(G.location);
  cards.allinplay.push(G.playerData[0].persona);
  cards.allinplay.push(G.playerData[1].persona);
  return cards;
}

function RemoveTemporaryStats(activeplayer: string, G: CMCGameState, ctx: Ctx) {
  const entities = AllCards(G).field.filter(
    (card) => OwnerOf(card, G) == activeplayer && card.type == CardType.MONSTER
  );
  entities.forEach((card) => {
    const entity = card as CMCMonsterCard;
    entity.temporaryAttack = 0;
    entity.temporaryLife = 0;
  });
}

function Undizzy(activeplayer: string, G: CMCGameState, ctx: Ctx) {
  const entities = AllCards(G).field.filter(
    (card) => OwnerOf(card, G) == activeplayer
  );
  entities.forEach((card) => {
    const entity = card as CMCEntityCard;
    entity.dizzy = false;
  });
}
function DizzyOne(findcard: CMCEntityCard, G: CMCGameState) {
  for (const slotplayer in G.slots) {
    for (const subplayer in G.slots[slotplayer]) {
      for (const subrow of G.slots[slotplayer][subplayer]) {
        const card: CMCEntityCard = subrow;
        if (findcard.guid == card.guid) {
          card.dizzy = true;
        }
      }
    }
  }
}
export {
  OwnerOf,
  CanClickCard,
  PlayEntity,
  PlayerPay,
  PlaceCard,
  RemoveFromHand,
  PlayerAddResource,
  DrawCard,
  DealDamage,
  DamageResult,
  CardScan,
  GenerateRandomGuid,
  resetActive,
  resetCombat,
  CheckState,
  Sacrifice,
  AddToGraveyard,
  IsMonster,
  IsPersona,
  Discard,
  CanDiscard,
  ForceDiscard,
  IsInHand,
  AllCards,
  GainTemporaryStats,
  RemoveTemporaryStats,
  Undizzy,
  DizzyOne,
  GainLife,
  IsEffect,
};
