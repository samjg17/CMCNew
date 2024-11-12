import React, { useState, useEffect } from "react";
import { icons } from "./Icons";
import { useNavigate } from "react-router-dom";

function GameOver({props, winner, player, dbid }) {
    const [rewards, setRewards] = useState<any[]>([]);
    const nav = useNavigate();

    const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        playeriD: dbid,
        victory: {
        type: "",
        victory: props.ctx.gameover.winner == player,
        },
    })};

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
        })
    }, []);
      
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
            <a onClick={() => nav("/home")}>Back to home</a>
        </div>
        
    </div>


    
    );
  
}

export default GameOver;
