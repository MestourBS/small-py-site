from gettext import gettext
from flask import Blueprint, render_template, url_for

routeGame = Blueprint('games', __name__, template_folder='templates')

@routeGame.route('/')
def games():
    links = [
        {'name': 'games_blockus', 'link': url_for('games.blockus_game')},
        #{'name': 'games_idle', 'link': url_for('games.idle_game')},
        #{'name': 'games_rpg', 'link': url_for('games.rpg_game')},
        #{'name': 'games_cidle', 'link': url_for('games.cidle_game')},
    ]
    return render_template('games/list.html', links=links)

@routeGame.route('/blockus')
def blockus_game():
    return render_template('games/blockus.html')

@routeGame.route('/idle')
def idle_game():
    return render_template('games/idle.html')

@routeGame.route('/rpg')
def rpg_game():
    return render_template('games/rpg.html')

@routeGame.route('/cidle')
def cidle_game():
    return render_template('games/cidle.html')

