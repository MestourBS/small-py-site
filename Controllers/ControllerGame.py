from flask import Blueprint, render_template, Response

routeGame = Blueprint('games', __name__, template_folder='templates')

@routeGame.route('/blockus')
def blockus_game():
    return render_template('games/blockus.html')

@routeGame.route('/idle')
def idle_game():
    return render_template('games/idle.html')

@routeGame.route('/rpg')
def rpg_game():
    return render_template('games/rpg.html')
