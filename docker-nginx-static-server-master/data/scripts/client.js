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
        return {
            text: text,
            files: files
        };
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

    static send(receiverid, other, my){
        if(other == null || my == null) throw new Error(this.SML_ERR+": client-message must be set!");
        return JSON.stringify(this.clientQuery0(
            "send",
            {
                "receiver-id": receiverid,
                "message-for-receiver": other,
                "message-for-sender": my
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
                    let publicRsa =j["args"]["public-key"];
                    let privateRsa = j["args"]["private-key"];
                    let pass = this.#pass_field.value;
                    var puk = forge.pki.publicKeyFromPem(publicRsa);
                    var prk = forge.pki.decryptRsaPrivateKey(privateRsa, pass);
                    up.getId = function (){
                        return id;
                    };
                    up.getPublicRSA = function (){
                        return puk;
                    };
                    up.getPrivateRSA = function (){
                        return prk;
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

    #dialog;

    #inp;

    #errors;

    #users = {};

    reset() {
        this.#user_ul = null;
        this.#search_bar = null;
        this.#dialog = null;
        this.#inp = null;
        this.#errors = null;
    }

    set(){
        this.#user_ul = document.getElementById("contacts_ul");
        this.#search_bar = document.getElementById("search_bar");
        this.#dialog = document.getElementsByClassName("chat_content")[0];
        this.#inp = document.getElementById("sendMessage");
        this.#errors = document.getElementById("errors");
        this.#selected=null;
        var that = this;
        this.#inp.addEventListener("change", function (e){
            let msg = e.target.value.trim();
            if(msg !== ""){
                that.sendMessage(that.#selected, msg);
            }
        });
        this.#search_bar.addEventListener("keyup", function (e){
            that.pressHandle(e);
        });
    }

    enc(up, msg){
        var key = forge.random.getBytesSync(16);
        var cipher = forge.aes.createEncryptionCipher(key, 'CBC');
        cipher.start(key);
        cipher.update(forge.util.createBuffer(msg, 'utf8'));
        cipher.finish();
        var encrypted = cipher.output.data;
        return up.getPublicRSA().encrypt(key)+encrypted;
    }

    dec(up, data){
        let key = up.getPrivateRSA().decrypt(data.substring(0, 128));
        data = data.substring(128, data.length);
        let c = forge.aes.createDecryptionCipher(key, 'CBC');
        c.start(key);
        c.update(forge.util.createBuffer(data));
        c.finish();
        return c.output.toString('utf8');
    }

    sendMessage(to, message){
        let lp = this._globalController.getUserProvider();
        this.send(SMLN_PROTO.send(to["user"]["id"], SMLN_PROTO.clientMessage(
            this.enc(to["provider"], message),
            []
        ), SMLN_PROTO.clientMessage(
            this.enc(lp, message),
            []
        )));
        to["last"] = {
            "text": message,
            "sender": lp.getId(),
            "receiver": to["user"]["id"],
            "time": parseInt(Date.now()/1000),
            "files": [] // TODO: files
        }
        this.#users[to["id"]] = to;
        this.#dialog.innerHTML = this.message(false, message) + this.#dialog.innerHTML;
        this.#inp.value="";
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

    #selected;

    message(my, text){
        let msg = `
            <div class="chat_message ${(!my?"chat_item-responder":"")}">
                <div class="chat_message-content">${text}</div>
            </div>`
        return msg;
    }

    loadDialog(){
        if(this.#selected == null){
            this.#inp.disabled = true;
            this.#dialog.innerHTML = "No users selected!";
            this.#dialog.classList.add("empty_obj");
        }else{
            this.#inp.disabled = false;
            if(this.#selected["user"]["id"] in this.#users){
                this.#dialog.classList.remove("empty_obj");
                this.#dialog.innerHTML = "";
                this.#curentMsgs.forEach(d => {
                    this.#dialog.innerHTML += this.message(d["my"], d["text"]);
                });
            }else{
                this.#dialog.innerHTML = "No dialog yet! Start messaging.";
            }
        }
    }

    #curentMsgs = [];
    #msgWait=false;
    getMessages(){
        this.send(SMLN_PROTO.messages(this.#selected["user"]["id"], SMLN_PROTO.listProperties(0, 30)));
    }

    refillUsers(){
        if(Object.keys(this.#users).length === 0){
            this.#user_ul.classList.add("empty_obj");
            this.#user_ul.innerHTML="No contacts available! Use searchbar to find specific ones.";
        }else{
            this.#user_ul.classList.remove("empty_obj");
            var that = this;
            this.#user_ul.innerHTML="";
            Object.keys(this.#users).forEach(k => {
                var use = this.#users[k]["user"];
                let m = this.#users[k]["last"];
                let lp = this._globalController.getUserProvider();
                let e = this.user(use, this.dec(lp,m["text"]));
                e.onclick = function (e){
                    // for (let li in document.getElementsByClassName("selected")){
                    //     li.classList.remove("selected");
                    // }
                    that.#selected = that.#users[k];
                    e.target.classList.add("selected");
                    that.loadDialog();
                    that.getMessages();
                }
                this.#user_ul.appendChild(e);
            })
        }
    }

    refillOnlyUsers(users){
        if(users.length === 0){
            this.#user_ul.classList.add("empty_obj");
            this.#user_ul.innerHTML="No contacts available! Use searchbar to find specific ones.";
        }else{
            this.#user_ul.classList.remove("empty_obj");
            var that = this;
            this.#user_ul.innerHTML="";
            users.forEach(u => {
                let e = this.user(u, "");
                var puk = forge.pki.publicKeyFromPem(u["public-key"]);
                var user = u;
                let up = new UserProvider();
                up.getId = function (){
                    return user["id"];
                };
                up.getPublicRSA = function (){
                    return puk;
                }
                e.onclick = function (ev){
                    that.#selected = {
                        "user": user,
                        "provider": up
                    }
                    e.classList.add("selected");
                    that.loadDialog();
                    that.getMessages();
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
            setTimeout(t => {
                this.#errors.innerHTML="";
            }, 1000);
            if(SMLN_PROTO.type(j) === "people-with-messages"){
                let chats = j["args"]["chats"];
                chats.forEach(c => {
                    let user = c["user"];
                    let m = c["last-message"];
                    let up = new UserProvider();
                    var uid = user["id"];
                    var puk = forge.pki.publicKeyFromPem(user["public-key"]);
                    up.getId = function (e){
                        return uid;
                    }
                    up.getPublicRSA = function (e){
                        return puk;
                    }
                    this.#users[user["id"]] = {
                        "user": user,
                        "provider": up,
                        "last": m
                    };
                });
                this.refillUsers();
                this.loadDialog();
            }else if(SMLN_PROTO.type(j) === "people"){
                let users = j["args"]["users"];
                this.refillOnlyUsers(users);
            }else if(SMLN_PROTO.type(j) === "messages"){
                let msgs = j["args"]["messages"];
                let lp = this._globalController.getUserProvider();
                this.#curentMsgs = msgs.map(m =>{
                    let d =  { "text": this.dec(lp, m["text"]), "my": (m["receiver"] === lp.getId())};
                    return d;
                });
                this.loadDialog();
            }else if(SMLN_PROTO.type(j) === "message-received"){
                let msg = j["args"]["message"];
                let sender = msg["sender"];
                let lp = this._globalController.getUserProvider();
                if(this.#selected != null && this.#selected["user"]["id"] === sender){
                    this.#dialog.innerHTML = this.message(true, this.dec(lp, msg["text"])) + this.#dialog.innerHTML;
                }
            }else if(SMLN_PROTO.type(j) === "activity-update"){
                // FUTURE
            }
        }else{
            this.#errors.innerHTML = SMLN_PROTO.localizedResponse(j);
            if(!SMLN_PROTO.isKnownResponseStatus(j)){
                console.log(this.currentError()+`: WARNING! unlocalized response: "${j["status"]["error-message"]}"`);
            }
        }
    }

}

class MenuController extends AbstractPageController{
    init() {
        // language=HTML
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
        <div class="chat_content">
        </div>
        <div class="panel">
        <input id="sendMessage" rows="4" cols="50" name="comment" form="usrform"></input>
        </div>
        </div>
        </div>
        <div id="errors"></div>
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

    #extras = [
        "message-received",
        "activity-update"
    ]

    #onmessageFilter(event){
        // try{
            let packet = JSON.parse(event.data);
            if(SMLN_PROTO.isValidResponse(packet) || (packet.hasOwnProperty("type") && this.#extras.includes(SMLN_PROTO.type(packet)))){
                if(this.#extras.includes(SMLN_PROTO.type(packet))){
                    packet["status"] = {
                        "status": SMLN_PROTO.RESPONSE_STATUS.SUCCESS
                    };
                }
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
        // }catch (e){
        //     if(e instanceof SyntaxError){
        //         console.log(GlobalController.GC_ERR+": ERROR! received data is invalid and can not be parsed!");
        //     }else{
        //         console.log(GlobalController.GC_ERR+`: ERROR! unexpected error '${e}' while listening to websocket!`);
        //     }
        // }
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
        let server_addr = "wss://localhost:444";
        let jc = new GlobalController(server_addr);
        jc.switch(GlobalController.PAGES.LOAD);
    }
}