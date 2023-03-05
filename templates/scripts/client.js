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

    static queryAuth(login, pass){
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

    constructor(globalc) {
        this._globalController = globalc;
    }
    init() {
        throw new Error("AbstractPageController method 'init' must be implemented!");
    }

    unload(){
        throw new Error("AbstractPageController method 'unload' must be implemented!");
    }
}

class SignInController extends AbstractPageController{
    init() {
        this._globalController.pageInner().innerHTML = `
        <div class="form">
        <h1 class="auth">Please, authenticate </h1>
        <input type="text" placeholder="Login">
        <input type="password" placeholder="Password">
        <button class="form-btn">Enter</button>
        <a class="forgot-p" href="#"> Submit</a>
        </div>
        `;
    }

    unload() {

    }
}

class GlobalController{
    static PAGES = {
        SIGN_IN: "SIGN_IN",
        PASS_SET: "PASS_SET",
        WELCOME: "WELCOME",
        MENU: "MENU"
    }

    #pagec;

    #current;

    #avPages;

    static{
        let jc = new GlobalController();
        jc.switch(GlobalController.PAGES.SIGN_IN);
    }

    pageInner(){
        return this.#pagec;
    }

    switch(pname){
        if(this.#current != null){
            this.#current.unload();
        }
        this.#current = this.#avPages[pname];
        this.#current.init();
    }

    _initPages(){
        this.#avPages = {
            "SIGN_IN": new SignInController(this)
        };
    }

    constructor() {
        this.#current = null;
        this.#pagec = document.getElementById("pagec");
        this._initPages();
    }
}