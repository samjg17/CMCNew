import React, { CSSProperties, useState, MouseEvent, useEffect } from "react";
import useMousePosition from "./UseMousePosition";
import CMCCardVisual from "./Card";
import { OwnerOf } from "../../shared/LogicFunctions";


function HoverBigCard({props, hoverCard, otherPlayer}) {

    const mousePosition = useMousePosition();

    return (
        <div
          className="hoverbigcard"
          id="hoverbigcard"
          style={{
            left: mousePosition.x ? mousePosition.x + 10 : 0,
            top: mousePosition.y ? mousePosition.y + 10 : 0,
          }}
        >
          <CMCCardVisual
            G={props.G}
            ctx={props.ctx}
            big={true}
            activeCard={false}
            player={props.G.playerData[OwnerOf(hoverCard, props.G)]}
            card={hoverCard}
            doClick={() => {}}
            canClick={false}
            key={"player" + otherPlayer}
          />
        </div>
    )
}

export default HoverBigCard
