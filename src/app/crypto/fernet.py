from cryptography.fernet import Fernet


def create_fernet(key: str) -> Fernet:
    return Fernet(key.encode())


def encrypt_value(cipher: Fernet, value: str) -> str:
    return cipher.encrypt(value.encode()).decode()


def decrypt_value(cipher: Fernet, token: str) -> str:
    return cipher.decrypt(token.encode()).decode()
