from flask import Blueprint
from flask.templating import render_template

routeHome = Blueprint('home', __name__, template_folder='templates')

@routeHome.route('/')
def home():
    return render_template('home.html')
