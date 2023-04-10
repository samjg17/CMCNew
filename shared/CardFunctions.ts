import { Ctx } from "boardgame.io";
import { couldStartTrivia } from "typescript";
import {
  Ability,
  TriggeringTrigger,
  TriggerNames,
  TriggerPlayerType,
} from "./Abilities";
import { CMCGameState } from "./CardmasterGame";
import {
  CMCCard,
  CMCMonsterCard,
  CMCPersonaCard,
  GetModifiedStatCard,
} from "./CMCCard";
import { CardType } from "./Constants";
import {
  DealDamage,
  IsMonster,
  IsPersona,
  OwnerOf,
  PlayerAddResource,
  PlayerPay,
} from "./LogicFunctions";
import { CMCPlayer } from "./Player";

// defaultcost checks everything in the player.resources against the card.cost.
export function DefaultCost(
  card: CMCCard,
  playertocheck: string,
  G: CMCGameState,
  ctx: Ctx,
  dry: boolean
): boolean {
  const fullplayer: CMCPlayer = G.playerData[playertocheck];

  if (!fullplayer) {
    return false;
  }
  const modcard = GetModifiedStatCard(card);
  for (const check in modcard.cost) {
    for (const sub in modcard.cost[check]) {
      if (fullplayer.resources[check][sub] < modcard.cost[check][sub]) {
        return false;
      }
    }
  }

  // if we are actually calling to check
  if (!dry) {
    if (!PlayerPay(playertocheck, modcard.cost, G)) {
      return false;
    }
  }
  return true;
}

export function IsDamagable(
  card: CMCCard,
  cardowner: string,
  target: CMCCard,
  G: CMCGameState,
  ctx: Ctx
): boolean {
  // can only damage in field
  let found: boolean = false;

  if (target.type == CardType.MONSTER) {
    for (const slotplayer in G.slots) {
      for (const subplayer in G.slots[slotplayer]) {
        for (const [index, slotcard] of G.slots[slotplayer][
          subplayer
        ].entries()) {
          if (slotcard.guid == target.guid) {
            found = true;
          }
        }
      }
    }
  } else if (target.type == CardType.PERSONA) {
    return true;
  }
  // is it a damagable type
  return found && (IsMonster(target) || IsPersona(target));
}

export function ManaGenerate(
  card: CMCCard,
  ability: Ability,
  trigger: TriggeringTrigger,
  owner: string,
  G: CMCGameState,
  ctx: Ctx,
  target?: CMCCard
): boolean {
  let playerid = OwnerOf(card, G);
  let player: CMCPlayer = G.playerData[playerid];

  let resource = {
    mana: {},
  };
  resource.mana[ability.metadata.color] = ability.metadata.amount;

  PlayerAddResource(playerid, resource, G);

  G.playerData[ctx.currentPlayer] = player;
  return true;
}

export function TriggerStage(
  card: CMCCard,
  ability: Ability,
  trigger: TriggeringTrigger,
  owner: string,
  G: CMCGameState,
  ctx: Ctx
): boolean {
  if (!ctx.activePlayers) {
    return false;
  }
  let playerToCheck = owner;
  if (trigger.triggeringPlayer != owner) {
    return false;
  }
  if (ctx.activePlayers[playerToCheck] != ability.metadata.triggerstage) {
    return false;
  }
  if (trigger.name != ability.metadata.triggername) {
    return false;
  }
  return true;
}

export function DamageTarget(
  card: CMCCard,
  ability: Ability,
  trigger: TriggeringTrigger,
  owner: string,
  G: CMCGameState,
  ctx: Ctx,
  target?: CMCCard
) {
  if (!target) return false;
  if (![CardType.PERSONA, CardType.MONSTER].includes(target.type)) {
    return false;
  }
  if (IsMonster(target) || IsPersona(target)) {
    DealDamage(target, card, ability.metadata.amount, G);
    return true;
  } else {
    return false;
  }
}
