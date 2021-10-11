from flask import Blueprint
from flask import render_template, Response

routeGame = Blueprint('games', __name__, template_folder='templates')

@routeGame.route('/tetris')
def tetris_game():
    return render_template('games/tetris.html')

@routeGame.route('/tetris.js')
def tetris_js():
    script = render_template('games/tetris.js')
    return Response(script, mimetype='application/javascript')
