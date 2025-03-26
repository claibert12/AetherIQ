from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import os
from typing import Dict, Any, Optional
from datetime import datetime
import json

class EncryptionService:
    def __init__(self, master_key: str):
        """Initialize encryption service with master key"""
        self.master_key = master_key.encode()
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize encryption components"""
        # Generate a salt for key derivation
        self.salt = os.urandom(16)
        
        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
            backend=default_backend()
        )
        self.key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
        
        # Initialize Fernet for symmetric encryption
        self.fernet = Fernet(self.key)
    
    def encrypt_data(self, data: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Encrypt data using AES-256"""
        # Convert data to JSON string
        json_data = json.dumps(data)
        
        # Encrypt the data
        encrypted_data = self.fernet.encrypt(json_data.encode())
        
        # Create encryption metadata
        encryption_metadata = {
            "encryption_time": datetime.utcnow().isoformat(),
            "algorithm": "AES-256",
            "key_derivation": "PBKDF2-SHA256",
            "iterations": 100000,
            "salt": base64.b64encode(self.salt).decode(),
            "metadata": metadata or {}
        }
        
        return {
            "encrypted_data": base64.b64encode(encrypted_data).decode(),
            "encryption_metadata": encryption_metadata
        }
    
    def decrypt_data(self, encrypted_package: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt data using AES-256"""
        try:
            # Decode encrypted data
            encrypted_data = base64.b64decode(encrypted_package["encrypted_data"])
            
            # Decrypt the data
            decrypted_data = self.fernet.decrypt(encrypted_data)
            
            # Convert back to dictionary
            return json.loads(decrypted_data.decode())
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")
    
    def rotate_key(self, new_master_key: str):
        """Rotate the encryption key"""
        self.master_key = new_master_key.encode()
        self._initialize_encryption()
    
    def verify_encryption(self, encrypted_package: Dict[str, Any]) -> bool:
        """Verify that data is properly encrypted"""
        try:
            # Attempt to decrypt the data
            self.decrypt_data(encrypted_package)
            return True
        except:
            return False 