let last_id = 0;
if (typeof gettext != 'function') {
    /**
     * @param {string} text Variables are inserted with `%(<name>)s`
     * @param {{[k: string]: string|number}} variables
     * @returns {string}
     */
    function gettext(text, variables) {}
}

function init() {
    let refresh_interval = 0;
    let refresh_delay = 500;
    if (!window.refresh_delay) {
        Object.defineProperty(window, 'refresh_delay', {
            get() {
                return refresh_delay;
            },
            set(value) {
                refresh_delay = Math.max(value, 100);
                clearInterval(refresh_interval);
                refresh_interval = setInterval(() => fetchMessages(), refresh_delay);
            }
        });
    }
    clearInterval(refresh_interval);
    refresh_interval = setInterval(() => fetchMessages(), refresh_delay);
}
function fetchMessages() {
    let url = Flask.url_for('chat.messages_view', {group_id, last_message:last_id});
    let regex = /\?.*$/;
    // It's not automatically encoded, ffs
    url = url.replace(regex, encodeURIComponent);
    fetch(url)
        .then(b => b.json())
        .then(json => {
            Object.values(json).forEach(parseMessage);
        });
}
/**
 * @param { {
 *  id: number,
 *  username: string,
 *  user_id: number,
 *  contents: {
 *      id: number,
 *      type: 'text'|'image'|'video'|'sound'|'file',
 *      content: string,
 *      mime?: string
 *  }[]
 * } } message
 */
function parseMessage(message) {
    let container = document.createElement('div');
    let top_div = document.createElement('div');
    let username = document.createElement('b');
    let content_div = document.createElement('div');

    username.innerText = message.username;

    top_div.appendChild(username);
    for (let content of message.contents) {
        content_div.appendChild(parseContent(content));
    }
    container.appendChild(top_div);
    container.appendChild(content_div);
    if (message.user_id == user_id) {
        let del = document.createElement('button');
        del.innerText = '✖';
        del.style.marginLeft = '20px';
        del.addEventListener('click', e => {
            if (confirm(gettext('chat_confirm_delete_message'))) {
                let url = Flask.url_for('chat.message_delete', {message_id: message.id});
                let regex = /\?.*$/;
                // It's not automatically encoded, ffs
                url = url.replace(regex, encodeURIComponent);
                fetch(url).then(e => {
                    if (e.ok) {
                        container.parentElement.removeChild(container);
                    }
                });
            }
        });
        top_div.appendChild(del);
    }
    document.getElementById('messages').appendChild(container);

    last_id = Math.max(last_id, message.id);
}
/**
 * @param { {
 *  id: number,
 *  type: 'text'|'image'|'video'|'sound'|'file',
 *  content: string,
 *  mime?: string
 * } } content
 */
function parseContent(content) {
    switch(content.type) {
        case 'text':
        default:
            let text = document.createElement('div');
            text.innerHTML = content.content;
            return text;
        case 'image':
            let image = document.createElement('img');
            image.src = Flask.url_for('static', {filename: 'uploads/' + content.content});
            return image;
        case 'video':
            let video = document.createElement('video');
            let vsource = document.createElement('source');
            vsource.src = Flask.url_for('static', {filename: 'uploads/' + content.content});
            vsource.type = content.mime;
            video.appendChild(vsource);
            return video;
        case 'sound':
            let audio = document.createElement('audio');
            let asource = document.createElement('source');
            asource.src = Flask.url_for('static', {filename: 'uploads/' + content.content});
            asource.type = content.mime;
            audio.appendChild(asource);
            return audio;
        case 'file':
            let link_div = document.createElement('div');
            let link = document.createElement('a');
            link.rel = 'noopener noreferrer nofollow';
            link.href = Flask.url_for('static', {filename: 'uploads/' + content.content});
            link.innerText = content.content;
            link_div.appendChild(link);
            return link_div;
    }
}

// lets go
init();
