import React, { useState, useEffect, useMemo } from "react";
import { icons } from "./Icons";

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
            {winner == player ? "You won :)" : "You lost :("}
            <div className="rewards">
                REWARDS:
                <br />
                {rewards.map((reward, index) => (
                    <div
                        key={index}
                        className="reward"
                        style={{ animationDelay: `${index * 0.2}s` }}
                    >
                        {icons["letter" + reward.toLowerCase()]}
                    </div>
                ))}
            </div>
            <div>
                <a href="/home">Back to home</a>
            </div>
        </div>
    );
}

export default GameOver;