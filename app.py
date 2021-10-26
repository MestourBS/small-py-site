#!/usr/bin/python python
# -*- coding: utf-8 -*-

import sys

sys.path.append('./modules')

from flask import Flask, render_template, request, session
from flask_babel import Babel
from flask_jsglue import JSGlue
from flask_babel_js import BabelJS
from Controllers import routeHome, routeAuth, routeChat, routeGame

app = Flask(__name__)
babel = Babel(app)
jsglue = JSGlue(app)
babel_js = BabelJS(app)

app.secret_key = 'a'
app.url_map.strict_slashes = False
app.register_blueprint(routeHome, url_prefix='/')
app.register_blueprint(routeAuth, url_prefix='/auth')
app.register_blueprint(routeChat, url_prefix='/chat')
app.register_blueprint(routeGame, url_prefix='/games')

# Page à afficher en cas d'erreur 404
@app.errorhandler(404)
def page_not_found(e):
	return render_template('errors/404.html'), 404

@babel.localeselector
def get_locale() -> str:
	if 'lang' in session:
		return session['lang']
	return request.accept_languages.best_match(['fr', 'en'])

if __name__ == '__main__':
	app.secret_key = b'_5#_GRAND_PAS_ARAGORN_F4Q8z\n\xec]'
	app.debug = True
	context = ('sectioninformatique.net-2019-11-27.crt', 'sectioninformatique.net-2019-11-27.key')
	app.run(host='127.0.0.1', port=5000)
	app.run(host='0.0.0.0', port=5000, ssl_context=context)
