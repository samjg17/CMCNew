import { useEffect, useState } from "react";
import "../style/login.css";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import qrcode from "qrcode";
import { DbPlayer } from "../../server/DbTypes";
enum CREATE {
  NOT = 0,
  QR = 1,
}
function CreatePlayer() {
  const [name, setName] = useState(0);
  const [loginstage, setloginstage] = useState(CREATE.NOT);
  const [qruri, setqruri] = useState("");
  const [authcode, setauthcode] = useState("");
  const navigate = useNavigate();
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formElements = form.elements as typeof form.elements & {
      nameInput: { value: string };
      deckInput: { value: string };
    };
    const namec = formElements.nameInput.value;
    const deckc = formElements.deckInput.value;

    // create or load user

    fetch("/api/manage/player/create/" + namec + "/" + deckc)
      .then((response) => response.json())
      .then((data) => {
        //todo error checking
        setloginstage(CREATE.QR);
        const playerdata: DbPlayer = data.player;
        setauthcode(playerdata.authenticationcode);
        const uri = data.keyuri;
        // generate qr

        qrcode.toDataURL(uri, (err, imgurl) => {
          setqruri(imgurl);
        });
      });
  }

  const qrbox = (
    <div className="qrbox">
      <header>Register this QR code in your mobile authenticator.</header>
      <label>Code: </label> {authcode}
      <div id="qrimg">
        <img src={qruri} />
      </div>
      <p>SKIPPING THIS STEP WILL RESULT IN NOT BEING ABLE TO LOG IN!!!!</p>
      <Link to="/">Return to login</Link>
    </div>
  );
  const initialform = (
  <div className="login">
    <div className="loginContainer">
      <div className="loginHeader">Sign Up</div>
      <form onSubmit={handleSubmit} className="loginForm">
        <div className="formGroup">
          <label htmlFor="nameInput">Name:</label>
          <input type="text" name="nameInput" id="nameInput" />
        </div>
        <div className="formGroup">
          <label htmlFor="deckInput">Deck:</label>
          <input type="text" name="deckInput" id="deckInput" value="debug" disabled />
        </div>
        <input type="submit" value="Submit" className="submitBtn" />
      </form>
    </div>
  </div>
  );
  return (
    <div className="App">
      {loginstage == CREATE.NOT ? initialform : ""}
      {loginstage == CREATE.QR ? qrbox : ""}
    </div>
  );
}

export default CreatePlayer;
