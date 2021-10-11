from flask import Blueprint, render_template, request, redirect, session
from flask.helpers import url_for
from flask_babel import gettext
from constants import MIN_PASSWORD_LENGTH
from Models import UserModel

routeAuth = Blueprint('auth', __name__, template_folder='templates')
user_model = UserModel()

@routeAuth.route('/login', methods=['GET', 'POST'])
def login():
    if 'username' in session:
        return redirect(url_for('home.home'))
    errors = []
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username:
            errors.append(gettext('auth_error_no_username'))
        if not password:
            errors.append(gettext('auth_error_no_password'))
        if not user_model.check_password(password, username):
            errors.append(gettext('auth_error_invalid_login'))
        if not errors:
            user = user_model.get(['id'], f'username = "{username}"')[0]
            session['username'] = username
            session['user_id'] = user['id']
            return redirect(url_for('home.home'))
    return render_template('auth/login.html', errors=errors)

@routeAuth.route('/register', methods=['GET', 'POST'])
def register():
    if 'username' in session:
        return redirect(url_for('home.home'))
    errors = []
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        password_confirm = request.form.get('confirm_password')
        if not username:
            errors.append(gettext('auth_error_no_username'))
        if not password:
            errors.append(gettext('auth_error_no_password'))
        if len(password) < MIN_PASSWORD_LENGTH:
            errors.append(gettext('auth_error_password_short', chars=MIN_PASSWORD_LENGTH))
        if password != password_confirm:
            errors.append(gettext('auth_error_passwords_not_match'))
        if not errors:
            user = {
                'username': username,
                'password': password
            }
            success = user_model.insert_single(user)
            if success:
                user = user_model.get(['id'], f'username = "{username}"')[0]
                session['username'] = username
                session['user_id'] = user['id']
                return redirect(url_for('home.home'))
            errors.append(gettext('auth_error_unknown'))
    return render_template('auth/register.html', errors=errors)

@routeAuth.route('/logout', methods=['GET', 'POST'])
def logout():
    del session['username']
    del session['user_id']
    return redirect(url_for('home.home'))

@routeAuth.route('/change_password', methods=['GET', 'POST'])
def change_password():
    if 'username' not in session:
        return redirect(url_for('auth.login'))
    errors = []
    if request.method == 'POST':
        password = request.form.get('password')
        password_new = request.form.get('password_new')
        password_confirm = request.form.get('confirm_password')
        if not password:
            errors.append(gettext('auth_error_no_password'))
        if not password_new:
            errors.append(gettext('auth_error_no_password_new'))
        if len(password_new) < MIN_PASSWORD_LENGTH:
            errors.append(gettext('auth_error_password_short', chars=MIN_PASSWORD_LENGTH))
        if password_new != password_confirm:
            errors.append(gettext('auth_error_passwords_not_match'))
        if not user_model.check_password(password, session['username']):
            errors.append(gettext('auth_error_wrong_password'))
        if not errors:
            success = user_model.change_password(session['username'], password, password_new)
            if success:
                return redirect(url_for('home.home'))
            errors.append(gettext('auth_error_unknown'))
    return render_template('auth/change_password.html', errors=errors)
