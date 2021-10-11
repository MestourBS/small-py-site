from .BaseModel import BaseModel

class ChatMessageContentModel(BaseModel):
    def __init__(self):
        super().__init__('chat_message_contents')
