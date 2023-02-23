import flask
from flask import Flask

app = Flask(__name__)


@app.route('/')
@app.route('/sign-in')
def sign_in():
    return flask.render_template("sign_in.html")


@app.route('/messanger')
def messanger():
    return flask.render_template("messanger.html")


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080)
