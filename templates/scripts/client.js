class SMLN_PROTO{
    static RESPONSE_STATUS = {
        SUCCESS : 0,
        ERROR_CL_WRONG_REQ : 1,
        ERROR_CL_WRONG_ARG: 2,
        ERROR_CL_WRONG_ACCESS_DENIED: 3,
        ERROR_CL_WRONG_AUTH: 4,
        ERROR_SERVER: 20
    }
    static SML_ERR = "SMLN_FORMAT_ERROR";

    static isValidResponse(j){
        return j.hasOwnProperty("type") && j.hasOwnProperty("status") && j.hasOwnProperty("args");
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

    static listProperties(from=0, count=0, sort, filter, is_ascending=true){
        if(sort == null || filter == null) throw new Error(this.SML_ERR+": sort and filter must be set!");
        return JSON.stringify({
            from: from,
            count: count,
            sort: sort,
            filter: filter,
            "is-ascending": is_ascending
        });
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
            "people-with-message",
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

    #sign_btn;

    #login_field;
    #pass_field;

    reset() {
        this.#sign_btn = null;
        this.#login_field = null;
        this.#pass_field = null;
    }

    set() {
        this.#sign_btn = document.getElementById("sgnbtn");
        this.#login_field = document.getElementById("lgnfld");
        this.#pass_field = document.getElementById("passfld");
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
        // TODO: password must be hashed! Currently not hashed.
        //this.send(SMLN_PROTO.auth(login, pass));
        this._globalController.switch(GlobalController.PAGES.WELCOME);
    }

    onMessage(data) {

    }
}

class WelcomeCommunicator extends AbstractCommunicator{

    #usersBlock;
    reset() {
        this.#usersBlock = null;
    }

    set() {
        this.#usersBlock = document.getElementById("usrblck");
    }
}

class WelcomeController extends AbstractPageController{
    init() {
        let page = `
        <div class="form_second">
        <h1 class="auth">Welcome! </h1>
        <h2 class="small_auth">Please, select users: </h2>
        <div class="users">
        <ul id="usrblck">
        </ul>
        </div>
        <button class="form-btn">Enter</button>
        </div>`
        this._globalController.updateContent(page);
        this._wsController.set();
    }

    oneUser(iconurl, name){
        return `
        <li>
        <div class="user">
        <div class="image">
        <img src="${iconurl}" width=100px height=100px>
        </div>
        <div class="name" text-align: center>
        ${name}
        </div>
        </div>
        </li>`
    }

    unload() {
        this._wsController.reset();
    }
}

class SignInController extends AbstractPageController{
    init() {
        let page = `
        <div class="form">
        <h1 class="auth">Please, authenticate </h1>
        <input id="lgnfld" type="text" placeholder="Login">
        <input id="passfld" type="password" placeholder="Password">
        <button id="sgnbtn" class="form-btn">Enter</button>
        <a class="forgot-p" href="#">Help</a>
        </div>
        `;
        this._globalController.updateContent(page);
        this._wsController.set();
    }

    unload() {
        this._wsController.reset();
    }
}

class GlobalController{

    static GC_ERR = "GC_LIFETIME_ERROR";

    static PAGES = {
        SIGN_IN: "SIGN_IN",
        PASS_SET: "PASS_SET",
        WELCOME: "WELCOME",
        MENU: "MENU"
    }

    #pagec;

    #gws;

    #currentPage;
    #currentWsc;

    #avPages;
    #avWsc;

    static{
        // Encapsulated init
        let server_addr = "ws://localhost";
        let jc = new GlobalController(server_addr);
        jc.switch(GlobalController.PAGES.SIGN_IN);
    }

    updateContent(str){
        this.#pagec.innerHTML = str;
    }

    /* Switches page controller to initiated  */
    switch(pname){
        if(!(pname in this.#avPages)){
            throw new Error(GlobalController.GC_ERR+": unknown page!");
        }
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
            "WELCOME": new WelcomeController(this, new WelcomeCommunicator(this, function (msg){that.#send(msg);}))
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
            }
        }catch (e){
            if(e instanceof SyntaxError){
                console.log(GlobalController.GC_ERR+": ERROR! received data is invalid and can not be parsed!");
            }else{
                console.log(GlobalController.GC_ERR+`: ERROR! unexpected error ${e} while listening to websocket!`);
            }
        }
    }

    constructor(addr) {
        this.#gws = new WebSocket(addr);
        this.#gws.onmessage = this.#onmessageFilter;
        this.#currentPage = null;
        this.#currentWsc = null;
        this.#pagec = document.getElementById("pagec");
        this._initPagesAndWsc();
        var that = this;
        window.addEventListener("beforeunload", function (event){
            if(that.#currentPage != null && !(that.#currentPage instanceof SignInController)){
                event.preventDefault();
                return event.returnValue = "Are you sure you want to leave this messenger session? Then you will have to reauthorize again.";
            }
        }, { capture: true });
    }
}