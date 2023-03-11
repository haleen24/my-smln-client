class SMLN_PROTO{
    static RESPONSE_STATUS = {
        SUCCESS : 0,
        ERROR_CL_WRONG_REQ : 1,
        ERROR_CL_WRONG_ARG: 2,
        ERROR_CL_WRONG_ACCESS_DENIED: 3,
        ERROR_CL_WRONG_AUTH: 4,
        ERROR_SERVER: 20
    }
    static SML_ERR = "SMLN_FORMAT";

    static isKnownResponseStatus(j){
        return j["status"]["status"] in Object.keys(SMLN_PROTO.RESPONSE_STATUS).map(k => SMLN_PROTO.RESPONSE_STATUS[k]);
    }

    static localizedResponse(j){
        let r = j["status"]["status"];
        switch (r){
            case 0:
                return "Success";
                break;
            case 1:
                return "Wrong request";
                break;
            case 2:
                return "Wrong arguments";
                break;
            case 3:
                return "Access denied";
                break;
            case 4:
                return "Wrong login or password";
                break;
            case 20:
                return "Server error";
                break;
            default:
                if(r <= 5 && r <= 19) return "Future reserved error";
                if(r <= 21 && r <= 127) return "Internal server error";
                return "Unlocalized error";
        }
    }

    static type(j){
        return j["type"];
    }

    static isValidResponse(j){
        return j.hasOwnProperty("type") && j.hasOwnProperty("status");
    }

    static isSuccess(j){
        return j["status"]["status"] === this.RESPONSE_STATUS.SUCCESS;
    }

    static hasArgs(j){
        return j.hasOwnProperty("args");
    }

    static clientFile(name, data){
        if(name == null || data == null) throw new Error(this.SML_ERR+": name and data must be set!");
        return JSON.stringify({
            name: name,
            data: data
        });
    }

    static clientMessage(text, files){
        if(text == null || files == null) throw new Error(this.SML_ERR+": text and files must be set!");
        return JSON.stringify({
            text: text,
            files: files
        });
    }

    static listProperties(from=0, count=0, sort=null, filter=null, is_ascending=true){
        return {
            from: from,
            count: count,
            sort: sort,
            filter: filter,
            "is-ascending": is_ascending
        };
    }

    static clientQuery0(type, args){
        // universal query form
        return {
            type: type,
            args: args
        };
    }

    static auth(login, pass){
        if(login == null || pass == null) throw new Error(this.SML_ERR+": login and pass must be set!");
        return JSON.stringify(this.clientQuery0(
            "auth",
            {
                login: login,
                pass: pass
            }
        ));
    }

    static peopleWithMessage(listProps){
        if(listProps == null) throw new Error(this.SML_ERR+": listProps must be set!");
        return JSON.stringify(this.clientQuery0(
            "people-with-messages",
            {
                "list-properties": listProps
            }
        ));
    }

    static people(listProps){
        if(listProps == null) throw new Error(this.SML_ERR+": listProps must be set!");
        return JSON.stringify(this.clientQuery0(
            "people",
            {
                "list-properties": listProps
            }
        ));
    }

    static messages(userid, listProps){
        if(listProps == null) throw new Error(this.SML_ERR+": listProps must be set!");
        return JSON.stringify(this.clientQuery0(
            "messages",
            {
                "user-id": userid,
                "list-properties": listProps
            }
        ));
    }

    static send(receiverid, cmessage){
        if(cmessage == null) throw new Error(this.SML_ERR+": client-message must be set!");
        return JSON.stringify(this.clientQuery0(
            "send",
            {
                "receiver-id": receiverid,
                message: cmessage
            }
        ));
    }

    static get_user(id){
        return JSON.stringify(this.clientQuery0(
            "get-user",
            {
                id: id
            }
        ));
    }
}

class AbstractPageController{
    _globalController;

    _wsController;

    constructor(globalc, cwsc) {
        this._globalController = globalc;
        this._wsController = cwsc;
    }
    init() {
        throw new Error("AbstractPageController method 'init' must be implemented!");
    }

    unload(){
        throw new Error("AbstractPageController method 'unload' must be implemented!");
    }
}

class AbstractCommunicator{

    currentError(){
        return "AC#"+this.constructor.name.toUpperCase();
    }

    _globalController;

    constructor(globalc, send_handle) {
        this._globalController = globalc;
        this.send = send_handle;
    }

    reset(){
        throw new Error("AbstractCommunicator method 'reset' must be implemented!");
    }

    set(){
        throw new Error("AbstractCommunicator method 'set' must be implemented!");
    }

    /* filtered and valid packet handle */
    onMessage(data){
        throw new Error("AbstractCommunicator method 'onMessage' must be implemented!");
    }

    /* send packet via ws, where 'msg' is json string */
    send(msg){
        throw new Error("AbstractCommunicator method 'send' must be overwritten by global controller!");
    }
}

class SignCommunicator extends AbstractCommunicator{

    #lock;
    #sign_btn;

    #login_field;

    #spec_msg;
    #pass_field;

    reset() {
        this.#lock=false;
        this.#sign_btn = null;
        this.#login_field = null;
        this.#pass_field = null;
        this.#spec_msg = null;
    }

    set() {
        this.#lock=false;
        this.#sign_btn = document.getElementById("sgnbtn");
        this.#login_field = document.getElementById("lgnfld");
        this.#pass_field = document.getElementById("passfld");
        this.#spec_msg = document.getElementById("spec-msg");
        var that = this;
        this.#sign_btn.onclick = function (e){
            that.#on_btn_sign();
        };
    }

    #on_btn_sign(){
        let login = this.#login_field.value;
        let pass = this.#pass_field.value;
        this.logIn(login, pass);
    }

    logIn(login,pass){
        this.send(SMLN_PROTO.auth(login, pass));
        this.lock();
    }

    lock(){
        this.#lock=true;
        this.#pass_field.disabled = true;
        this.#sign_btn.disabled = true;
        this.#login_field.disabled = true;
    }

    unlock(){
        this.#lock=false;
        this.#pass_field.disabled = false;
        this.#sign_btn.disabled = false;
        this.#login_field.disabled = false;
    }

    onMessage(j) {
        if(this.#lock){
            if(SMLN_PROTO.isSuccess(j)){
                if(SMLN_PROTO.type(j) === "auth"){

                    var up = new UserProvider();
                    var id = j["args"]["id"];
                    var publicRsa = j["args"]["public-key"];
                    var privateRsa = j["args"]["private-key"];
                    up.getId = function (){
                        return id;
                    };
                    up.getPublicRSA = function (){
                        return publicRsa;
                    };
                    up.getPrivateRSA = function (){
                        return privateRsa;
                    };
                    this._globalController.setUserProvider(up);
                    console.log(this.currentError()+": login successfully!");
                    this._globalController.switch(GlobalController.PAGES.MENU);
                }
            }else{
                this.unlock();
                this.#spec_msg.innerHTML = SMLN_PROTO.localizedResponse(j);
                if(!SMLN_PROTO.isKnownResponseStatus(j)){
                    console.log(this.currentError()+`: WARNING! unlocalized response: "${j["status"]["error-message"]}"`);
                }
            }
        }else{
            console.log(this.currentError()+": ERROR! Unexpected packet receive before authorization!");
        }
    }
}

class UserProvider{
    getId(){
        throw new Error("UserProvider method 'getId' must return user id!");
    }

    getPublicRSA(){
        throw new Error("UserProvider method 'getPublicKey' must return public RSA key!");
    }

    getPrivateRSA(){
        throw new Error("UserProvider method 'getPrivateKey' must return private RSA key!");
    }
}

class SignInController extends AbstractPageController{
    init() {
        let page = `
        <div class="form">
        <h1 class="auth">Please, authenticate </h1>
        <input id="lgnfld" type="text" placeholder="Login">
        <input id="passfld" type="password" placeholder="Password">
        <h3 id="spec-msg"></h3>
        <button id="sgnbtn" class="form-btn">Enter</button>
        <a class="forgot-p" href="#">Help</a>
        </div>
        `;
        this._globalController.updateContent(page);
        this._wsController.set();
    }

    unload() {

    }
}

class LoadController extends AbstractPageController{
    init() {
        this.processing();
    }

    processing(){
        let page = `
        <div id="load" class="load-process">
        <h1 class="def-f">Connecting...</h1>
        </div>
        `;
        this._globalController.updateContent(page);
    }

    failure(){
        let page = `
        <div id="load" class="load-failure">
        <h1 class="def-f">Messenger network is offline.</h1>
        <h1 class="def-f">Report it to your administration.</h1>
        </div>
        `;
        this._globalController.updateContent(page);
    }

    unload() {

    }
}

class MenuCommunicator extends AbstractCommunicator{

    #user_ul;

    #search_bar;

    #users = {};

    reset() {
        this.#user_ul = null;
        this.#search_bar = null;
    }

    set(){
        this.#user_ul = document.getElementById("contacts_ul");
        this.#search_bar = document.getElementById("search_bar");
        var that = this;
        this.#search_bar.addEventListener("keyup", function (e){
            that.pressHandle(e);
        });
    }

    pressHandle(e){
        if(document.activeElement.id === "search_bar"){
            let s = e.target.value;
            if(s.trim().length === 0){
                this.refillUsers();
            }else{
                this.send(SMLN_PROTO.people(SMLN_PROTO.listProperties(0, 10, "username", "name-startswith="+s, true)));
            }
        }
    }

    loadDialog(uid){
        console.log("2");
    }

    refillUsers(){
        if(Object.keys(this.#users).length === 0){
            this.#user_ul.innerHTML="No contacts available! Use searchbar to find specific ones.";
        }else{
            var that = this;
            this.#user_ul.innerHTML="";
            this.#users.forEach(k => {
                let user = this.#users[k]["user"];
                let m = this.#users[k]["last"];
                let e = this.user(user, m["text"]);
                e.onclick = function (e){
                    that.loadDialog(user["id"]);
                }
                this.#user_ul.appendChild(e);
            })
        }
    }

    refillOnlyUsers(users){
        if(users.length === 0){
            this.#user_ul.innerHTML="No contacts available! Use searchbar to find specific ones.";
        }else{
            var that = this;
            this.#user_ul.innerHTML="";
            users.forEach(u => {
                let e = this.user(u, "");
                e.onclick = function (e){
                    that.loadDialog(u["id"]);
                }
                this.#user_ul.appendChild(e);
            });
        }
    }

    user(us, message){
        let a = document.createElement('li');
        a.innerHTML = `<div class="user">
        <div class="image">
        <img src="/imgs/im2.png" width=50px height=50px>
        </div>
        <div class="username">${us["username"]}</div>
        ${message}
        </div>`;
        return a;
    }

    onMessage(j){
        if(SMLN_PROTO.isSuccess(j)){
            if(SMLN_PROTO.type(j) === "people-with-messages"){
                let chats = j["args"]["chats"];
                chats.forEach(c => {
                    let user = c["user"];
                    let m = c["last-message"];
                    this.#users[user["id"]] = {
                        "user": user,
                        "other": [],
                        "my": [],
                        "last": m
                    };
                });
                this.refillUsers();
            }else if(SMLN_PROTO.type(j) === "people"){
                let users = j["args"]["users"];
                this.refillOnlyUsers(users);
            }
        }else{
            //this.#spec_msg.innerHTML = SMLN_PROTO.localizedResponse(j);
            if(!SMLN_PROTO.isKnownResponseStatus(j)){
                console.log(this.currentError()+`: WARNING! unlocalized response: "${j["status"]["error-message"]}"`);
            }
        }
    }

}

class MenuController extends AbstractPageController{
    init() {
        let page = `
        <div class="column-chat">
        <div class="colomn">
        <div class="search">
        <div id="form">
        <input id="search_bar" type="text" placeholder="Search..." name="search">
        <i class="d27"></i>
        </div>
        </div>
        <div class="contacts">
        <ul id="contacts_ul">
        </ul>
        </div>
        </div>
        <div class="chat">
        <div class="info">
        </div>
        <div class="window">No users selected!</div>
        <div class="panel">
        <textarea class="sendMessage" rows="4" cols="50" name="comment" form="usrform">
        Enter text here...</textarea>
        </div>
        </div>
        </div>
        `;
        this._globalController.updateContent(page);
        this._wsController.send(SMLN_PROTO.peopleWithMessage(SMLN_PROTO.listProperties(0, 10)));
        this._wsController.set();
    }

    unload() {

    }
}

class GlobalController{

    static GC_ERR = "GC_LIFETIME";

    static PAGES = {
        SIGN_IN: "SIGN_IN",
        MENU: "MENU",
        LOAD: "LOAD"
    }

    #pagec;

    #gws;

    #currentPage;
    #currentWsc;

    #avPages;

    #userProvider;

    getUserProvider(){
        return this.#userProvider;
    }

    setUserProvider(p){
        if(p instanceof UserProvider){
            this.#userProvider=p;
        }else{
            throw new Error(GlobalController.GC_ERR+": 'p' instance must be a userProvider");
        }
    }

    updateContent(str){
        this.#pagec.innerHTML = str;
    }

    switch(pname){
        if(this.#currentPage != null){
            this.#currentPage.unload();
        }
        this.#currentPage = this.#avPages[pname];
        this.#currentWsc =  this.#avPages[pname]._wsController;
        this.#currentPage.init();
    }

    _initPagesAndWsc(){
        var that = this;
        this.#avPages = {
            "SIGN_IN": new SignInController(this, new SignCommunicator(this, function (msg){that.#send(msg);})),
            "MENU": new MenuController(this, new MenuCommunicator(this, function (msg){that.#send(msg);})),
            "LOAD": new LoadController(this, null)
        };
    }

    #send(str){
        this.#gws.send(str);
    }

    #onmessageFilter(event){
        try{
            let packet = JSON.parse(event.data);

            if(SMLN_PROTO.isValidResponse(packet)){
                // some filter logic
                if(this.#currentWsc != null){
                    this.#currentWsc.onMessage(packet);
                }else{
                    console.log(GlobalController.GC_ERR+": WARNING! current websocket controller is empty!");
                }
            }else{
                console.log(GlobalController.GC_ERR+": ERROR! received packet is invalid!");
                console.log(packet);
            }
        }catch (e){
            if(e instanceof SyntaxError){
                console.log(GlobalController.GC_ERR+": ERROR! received data is invalid and can not be parsed!");
            }else{
                console.log(GlobalController.GC_ERR+`: ERROR! unexpected error '${e}' while listening to websocket!`);
            }
        }
    }

    disable(){

    }

    constructor(addr) {
        var that = this;
        this.#gws = new WebSocket(addr);
        this._initPagesAndWsc();
        this.#pagec = document.getElementById("pagec");
        this.#currentPage = null;
        this.#currentWsc = null;
        this.#gws.onmessage = function (e){
            that.#onmessageFilter(e);
        };
        this.#gws.onerror = function (e) {
            if(that.#currentPage != null){
                that.switch(GlobalController.PAGES.LOAD);
                that.#currentPage.failure();
            }
            that.disable();
        };
        this.#gws.onopen = function (e) {
            that.switch(GlobalController.PAGES.SIGN_IN);
        };
    }

    static{
        // Encapsulated init
        let server_addr = "ws://localhost:8080";
        let jc = new GlobalController(server_addr);
        jc.switch(GlobalController.PAGES.LOAD);
    }
}