from .BaseModel import BaseModel

class ChatMessageModel(BaseModel):
    def __init__(self):
        super().__init__('chat_messages')
