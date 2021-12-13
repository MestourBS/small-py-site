from flask import Blueprint, session, redirect, render_template, url_for, request
from flask_babel import gettext
from Models import ChatGroupModel, UserChatGroupModel, UserModel, ChatMessageModel, ChatMessageContentTypeModel, ChatMessageContentModel
from pathlib import Path
from pymysql.converters import escape_string
import re
import mimetypes
import html
import markdown

routeChat = Blueprint('chat', __name__, template_folder='templates')

user_model = UserModel()
user_group_model = UserChatGroupModel()
group_model = ChatGroupModel()
message_model = ChatMessageModel()
message_content_model = ChatMessageContentModel()
message_content_type_model = ChatMessageContentTypeModel()

@routeChat.route('/')
def group_list():
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    links = user_group_model.get(['fk_chat_group'], f'fk_user = "{user_id}"')
    groups = group_model.get_primary(primary_value=[l['fk_chat_group'] for l in links])
    return render_template('chat/group_list.html', groups=groups)

@routeChat.route('/new', methods=['GET', 'POST'])
def group_create():
    if not check_logged():
        return redirect(url_for('home.home'))
    errors = []
    if request.method == 'POST':
        group_name = request.form.get('group_name')
        if not group_name:
            errors.append(gettext('group_error_no_name'))
        if not errors:
            group_model.insert_single({'name': group_name})
            group_id = group_model.get(['id'], f'name = "{group_name}"')[-1]['id']
            user_group_model.insert_single({'fk_user': session['user_id'], 'fk_chat_group': group_id})
            return redirect(url_for('chat.group_view', group_id=group_id))
    return render_template('chat/group_create.html', errors=errors)

@routeChat.route('/view?id=<int:group_id>')
def group_view(group_id: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    if not check_user_in_group(user_id, group_id):
        return redirect(url_for('group.group_list'))
    group = group_model.get_primary(group_id)[0]
    if not group:
        redirect(url_for('chat.group_create'))
    user_groups = user_group_model.get(['fk_user'], f'fk_chat_group = {group_id}')
    users = user_model.get_primary([ug['fk_user'] for ug in user_groups], ['username'])
    return render_template('chat/group_view.html', group=group, users=users, user_id=user_id)

@routeChat.route('/leave?id=<int:group_id>')
def group_leave(group_id: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    if check_user_in_group(user_id, group_id):
        user_group_model.delete(f'fk_user = "{session["user_id"]}"', f'fk_chat_group = "{group_id}"')
    return redirect(url_for('group.group_list'))

@routeChat.route('/invite?id=<int:group_id>', methods=['GET', 'POST'])
def group_invite(group_id: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    if not check_user_in_group(user_id, group_id):
        return redirect(url_for('chat.group_list'))
    if request.method == 'POST':
        users = request.form.getlist('users')
        for id in users:
            user_group_model.insert_single({'fk_chat_group': group_id, 'fk_user': id})
        return redirect(url_for('chat.group_view', group_id=group_id))
    users = user_model.get(['id', 'username'])
    users = [u for u in users if not user_group_model.get(['id'], f'fk_user = "{u["id"]}"', f'fk_chat_group = "{group_id}"')]
    return render_template('chat/group_invite.html', users=users, group_id=group_id)

@routeChat.route('/messages?id=<int:group_id>&last=<int:last_message>')
def messages_view(group_id: int = 0, last_message: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    if not check_user_in_group(user_id, group_id):
        return redirect(url_for('chat.group_list'))
    messages = message_model.get(['id', 'fk_user'], f'fk_chat_group = {group_id}', f'id > {last_message}')
    if not messages:
        return {}
    users_ids = {msg['fk_user'] for msg in messages if msg['fk_user']}
    users = []
    types = {t['id'] : t['type'] for t in message_content_type_model.get()}
    message_contents = message_content_model.get(['*'], f'fk_message in (' + ','.join(str(msg['id']) for msg in messages) + ')')
    if users_ids:
        users = user_model.get_primary(users_ids, ['id', 'username'])
        users = {u['id']: u['username'] for u in users}
    mapped_messages = {}
    for message in messages:
        msg = {
            'id': message['id'],
            'username': users.get(message['fk_user'], gettext('chat_unknown_user')),
            'user_id': message['fk_user'],
            'contents': []
        }
        mapped_messages[msg['id']] = msg
    for content in message_contents:
        c = {
            'id': content['id'],
            'type': types[content['fk_type']],
            'content': content['content'],
            'mime': None
        }
        if c['type'] in ('audio', 'video'):
            c['mime'] = mimetypes.guess_type(c['content'])
        mapped_messages[content['fk_message']]['contents'].append(c)
    return mapped_messages

@routeChat.route('/send?id=<int:group_id>', methods=['POST'])
def message_create(group_id: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    user_id = session['user_id']
    if not check_user_in_group(user_id, group_id):
        return redirect(url_for('chat.group_list'))
    text = request.form.get('text')
    files = request.files.getlist('files')
    message_id = 0
    if text or files:
        message_model.insert_single({'fk_user': user_id, 'fk_chat_group': group_id})
        message_id = message_model.get(['id'], f'fk_user = {user_id}', f'fk_chat_group = {group_id}')[-1]['id']
    else:
        return redirect(url_for('chat.group_view', group_id=group_id))
    types = {t['type']: t['id'] for t in message_content_type_model.get()}
    if text:
        text = html.escape(text)
        text = markdown.markdown(text, extensions=[
            'markdown.extensions.sane_lists',
            'markdown.extensions.nl2br',
        ]).replace('<a ', '<a rel="noopener noreferrer nofollow" ');
        message_content_model.insert_single({'fk_message': message_id, 'fk_type': types['text'], 'content': escape_string(text)})
    type_switch = {
        'audio': types['sound'],
        'video': types['video'],
        'image': types['image'],
    }
    invalid_chars = re.compile('[^a-z\d]+', re.IGNORECASE)
    for f in files:
        (name, ext) = f.filename[::-1].split('.', 1)[::-1]
        name = invalid_chars.sub('-', name)[::-1]
        ext = ext[::-1]
        mime = mimetypes.guess_type(f'{name}.{ext}')[0]
        t = 0
        if mime:
            t = type_switch.get(mime.split('/')[0], types['file'])
        else:
            t = types['file']
        filename = f'{name}.{ext}'
        path = str(Path(__file__).parent.parent)
        f.save(path + '\\static\\uploads\\' + filename)
        message_content_model.insert_single({'fk_message': message_id, 'fk_type': t, 'content': f'"{filename}"'})
    return redirect(url_for('chat.group_view', group_id=group_id))

@routeChat.route('/delete?id=<int:message_id>')
def message_delete(message_id: int = 0):
    if not check_logged():
        return redirect(url_for('home.home'))
    message = message_model.get_primary(message_id)[0]
    if not message:
        return redirect(url_for('chat.group_list'))
    user_id = session['user_id']
    group_id = message['fk_chat_group']
    if not check_user_in_group(user_id, group_id):
        return redirect(url_for('chat.group_list'))
    if message['fk_user'] != user_id:
        return redirect(url_for('chat.group_view', group_id=group_id))
    message_model.delete_primary(message_id)
    return redirect(url_for('chat.group_view', group_id=group_id))

def check_logged():
    return 'user_id' in session

def check_user_in_group(user_id: int, group_id: int):
    return bool(user_group_model.get(['*'], f'fk_user = "{user_id}"', f'fk_chat_group = "{group_id}"'))
