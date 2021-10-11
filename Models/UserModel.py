from typing import Any
from .BaseModel import BaseModel
from passlib.context import CryptContext

class UserModel(BaseModel):
    def __init__(self):
        super().__init__('users')

    def check_password(self, password, username):
        pwd_context = CryptContext(
            schemes=["pbkdf2_sha256"],
            default="pbkdf2_sha256",
            pbkdf2_sha256__default_rounds=30000
        )
        user = self.get(['password'], f'username = "{username}"')
        return pwd_context.verify(password, user[0]['password'])

    def change_password(self, username, old_password, new_password):
        pwd_context = CryptContext(
            schemes=["pbkdf2_sha256"],
            default="pbkdf2_sha256",
            pbkdf2_sha256__default_rounds=30000
        )
        if not self.check_password(old_password, username):
            return
        new_password = pwd_context.encrypt(new_password)
        return self.update({'password': new_password}, f'username = "{username}"')

    def insert(self, columns: list[str], *values: list):
        if 'password' in columns:
            i = columns.index('password')
            for j in range(len(values)):
                passw = values[j][i]
                pwd_context = CryptContext(
                    schemes=["pbkdf2_sha256"],
                    default="pbkdf2_sha256",
                    pbkdf2_sha256__default_rounds=30000
                )
                values[j][i] = pwd_context.encrypt(passw)
        return super().insert(columns, *values)

    def update(self, columns: dict[str, Any], *conditions: str):
        if 'password' in columns:
            pwd_context = CryptContext(
                schemes=["pbkdf2_sha256"],
                default="pbkdf2_sha256",
                pbkdf2_sha256__default_rounds=30000
            )
            columns['password'] = pwd_context.encrypt(columns['password'])
        return super().update(columns, *conditions)
