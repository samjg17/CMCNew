import { useState } from "react";
import "../style/login.css";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import qrcode from "qrcode";
function Default() {
  const [name, setName] = useState("");
  const [isLog, setIsLog] = useState(false);
  const navigate = useNavigate();
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    //authenticate.
    setIsLog(true);
    event.preventDefault();
    const form = event.currentTarget;
    const formElements = form.elements as typeof form.elements & {
      username: { value: string };
      authcode: { value: string };
    };

    const username = formElements.username.value;
    const authcode = formElements.authcode.value;
    fetch("/api/manage/player/login/" + username + "/" + authcode)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setName(username);
          navigate("/home");
          setIsLog(false);
        }
      });
  }

  return (
  <div className="login">
    <div className="loginContainer">
      <div className="loginHeader">Login</div>
      <Link to="/player/create" className="createLink">
        Create New Account
      </Link>
      <form onSubmit={handleSubmit} className="loginForm">
        <div className="formGroup">
          <label htmlFor="username">Your Name:</label>
          <input type="text" name="username" id="username" />
        </div>
        <div className="formGroup">
          <label htmlFor="authcode">Authenticator Code:</label>
          <input type="text" name="authcode" id="authcode" />
        </div>
        <input type="submit" value="Submit" className="submitBtn" />
      </form>
    </div>
  </div>
  );
}



export default Default;
