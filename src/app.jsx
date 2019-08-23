import React from 'react';
import AceEditor from 'react-ace'

import 'brace/theme/terminal'
import 'brace/mode/lua'
import { runInThisContext } from 'vm';
import { Farmbot } from "farmbot";

const Store = require('./store.js');
const axios = require('axios');


const configStore = new Store({
  // We'll call our data file 'user-preferences'
  configName: 'user-preferences',
  defaults: {}
});

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      email: configStore.get("email"), 
      password: configStore.get("password"), 
      bot: null, token: null, connected: false,
      editorBuffer: configStore.get("editorBuffer"),
      responseBuffer: "",
      width: 0, height: 0
    };

    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.loadEmail = this.loadEmail.bind(this);
    this.handlePasswordlChange = this.handlePasswordlChange.bind(this);
    this.loadPassword = this.loadPassword.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.testScript = this.testScript.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }
  
  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    this.setState({ width: window.innerWidth, height: window.innerHeight });
  }

  testScript(event) {
    const editor = this.refs.editor.editor;
    const editorBuffer = editor.getValue();
    configStore.set("editorBuffer", editorBuffer);
    let bot = this.state.bot;
    let that = this;
    bot.send(bot.rpcShim([
      {
        kind: "assertion",
        args: {
          lua: editorBuffer,
          assertion_type: "abort",
          _then: {
            kind: "nothing",
            args: {}
          }
        }
      }
    ]))
    .then(function(result) {
      console.log("assertion passed");
      console.log(result);
      that.setState({responseBuffer: "OK"});
    })
    .catch(function(result) {
      console.log("assertion failed");
      console.dir(result);
      that.setState({responseBuffer: "assertion failed: " + result});
    })
  }

  loadEmail() {
    let email = configStore.get("email");
    if(email) {
      return email;
    } else {
      return ""
    }
  }

  loadPassword() {
    let password = configStore.get("password");
    if(password) {
      return password;
    } else {
      return ""
    }
  }

  handleEmailChange(event) {
    this.setState({email: event.target.value});
  }

  handlePasswordlChange(event) {
    this.setState({password: event.target.value});
  }

  handleSubmit(event) {
    let that = this;

    event.preventDefault();
    axios.post("https://staging.farm.bot/api/tokens", {
      user: {
        email: this.state.email,
        password: this.state.password
      }
    })
    .then(function (response) {
      if(response.status == 200) {
        console.log("got token");
        configStore.set("token", response.data.token.encoded);
        configStore.set("email", that.state.email);
        configStore.set("password", that.state.password);

        that.setState({password: null});
        that.setState({token: response.data.token.encoded});
        let bot = new Farmbot({ token: response.data.token.encoded });
        bot.connect()
        .then(function() {
          console.log("connected to bot");
          that.setState({bot: bot, connected: true});
        })
      } else {
        console.log(response);
        configStore.set("token", null);
      }
    })
    .catch(function(result) {
      console.log(result);
      configStore.set("token", null);
      that.setState({bot: null, connected: false, token: null});
    })
  }

  render() {
    return (
      <div>
        <AceEditor
          ref="editor"
          name="UNIQUE_ID_OF_DIV"
          mode='lua'
          theme='terminal'
          fontSize='22'
          width={this.state.width + 'px'}
          value={configStore.get("editorBuffer")}
        />

        <form onSubmit={this.handleSubmit}>
          <label>
            Email:
            <input type="email" value={this.loadEmail()} onChange={this.handleEmailChange} />
          </label>
          <label>
            Password:
            <input type="password" value={this.loadPassword()} onChange={this.handlePasswordlChange} />
          </label>
          <input type="submit" value="Submit" />
        </form>

        <label>
          Connection Status:
          <span className={this.state.connected ? "dot-green" : "dot-grey"} />
        </label>

        <button onClick={this.testScript}> 
          Test Script
        </button>
        <div>
          <p>
            <span> { this.state.responseBuffer } </span>
          </p>
        </div>
      </div>
    );
  }
}