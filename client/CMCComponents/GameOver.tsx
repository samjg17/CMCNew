import React, { useState, useEffect, useMemo } from "react";
import { icons } from "./Icons";
import { Link } from "react-router-dom";

function GameOver({ props, winner, player, dbid }) {
    const [rewards, setRewards] = useState<any[]>([]);

    // Use useMemo to memoize requestOptions to prevent it from being recreated on each render
    const requestOptions = useMemo(() => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            playerid: dbid,
            victory: {
                type: "",
                victory: props.ctx.gameover.winner == player,
            },
        })
    }), [dbid, props.ctx.gameover.winner, player]); 

    useEffect(() => {
        fetch("/api/manage/mats/give/", requestOptions)
            .then((response) => response.json())
            .then((data) => {
                if (data.letterrewards) {
                    setRewards(data.letterrewards);
                }
                if (data.cardawards) {
                    // todo
                }
            });
    }, [requestOptions]); // Dependency on requestOptions to ensure effect runs only when it changes

    return (
        <div className="winner">
            {winner == player ? "You won :)" : "you lost :("}
            <div className="rewards">
                REWARDS:
                {rewards.map((reward, index) => {
                    return <div key={index} className="reward">{icons["letter" + reward.toLowerCase()]}</div>;
                })}
            </div>
            <div>
                <Link reloadDocument to="/home">Back to home</Link>
            </div>
        </div>
    );
}

export default GameOver;
