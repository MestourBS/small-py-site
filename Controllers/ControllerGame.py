from flask import Blueprint
from flask import render_template, Response

routeGame = Blueprint('games', __name__, template_folder='templates')

@routeGame.route('/blockus')
def blockus_game():
    return render_template('games/blockus.html')

@routeGame.route('/blockus.js')
def blockus_js():
    script = render_template('games/blockus.js')
    return Response(script, mimetype='application/javascript')
