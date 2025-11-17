import CryptoJS from 'crypto-js';
import NodeRSA from 'node-rsa';
import { v4 as uuidv4 } from 'uuid';

export class MessageEncryption {
  private static instance: MessageEncryption;
  private chatKeys: Map<string, string> = new Map(); // chatId -> symmetric key
  private userKeys: Map<string, { publicKey: string; privateKey: string }> = new Map();

  private constructor() {}

  public static getInstance(): MessageEncryption {
    if (!MessageEncryption.instance) {
      MessageEncryption.instance = new MessageEncryption();
    }
    return MessageEncryption.instance;
  }

  // Generate RSA key pair for user
  public generateUserKeyPair(userId: string): { publicKey: string; privateKey: string } {
    const key = new NodeRSA({ b: 2048 });
    const publicKey = key.exportKey('public');
    const privateKey = key.exportKey('private');
    
    this.userKeys.set(userId, { publicKey, privateKey });
    
    return { publicKey, privateKey };
  }

  // Get user's public key
  public getUserPublicKey(userId: string): string | null {
    const keys = this.userKeys.get(userId);
    return keys ? keys.publicKey : null;
  }

  // Generate symmetric key for chat
  public generateChatKey(chatId: string): string {
    const key = CryptoJS.lib.WordArray.random(256/8).toString();
    this.chatKeys.set(chatId, key);
    return key;
  }

  // Encrypt symmetric key with user's public key
  public encryptKeyForUser(chatKey: string, userPublicKey: string): string {
    const key = new NodeRSA(userPublicKey);
    return key.encrypt(chatKey, 'base64');
  }

  // Decrypt symmetric key with user's private key
  public decryptKeyForUser(encryptedKey: string, userPrivateKey: string): string | null {
    try {
      const key = new NodeRSA(userPrivateKey);
      return key.decrypt(encryptedKey, 'utf8');
    } catch (error) {
      console.error('Error decrypting chat key:', error);
      return null;
    }
  }

  // Legacy method for backward compatibility (userId-based lookup)
  public decryptKeyForUserById(encryptedKey: string, userId: string): string | null {
    const keys = this.userKeys.get(userId);
    if (!keys) return null;
    
    try {
      const key = new NodeRSA(keys.privateKey);
      return key.decrypt(encryptedKey, 'utf8');
    } catch (error) {
      console.error('Error decrypting chat key:', error);
      return null;
    }
  }

  // Encrypt message content
  public encryptMessage(content: string, chatKey: string): {
    encryptedContent: string;
    iv: string;
  } {
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const encrypted = CryptoJS.AES.encrypt(content, chatKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encryptedContent: encrypted.toString(),
      iv: iv.toString()
    };
  }

  // Decrypt message content
  public decryptMessage(encryptedContent: string, iv: string, chatKey: string): string | null {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedContent, chatKey, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Error decrypting message:', error);
      return null;
    }
  }

  // Get or create chat key
  public getChatKey(chatId: string): string {
    let key = this.chatKeys.get(chatId);
    if (!key) {
      key = this.generateChatKey(chatId);
    }
    return key;
  }

  // Store chat key (when retrieved from database)
  public storeChatKey(chatId: string, key: string): void {
    this.chatKeys.set(chatId, key);
  }

  // Clear user keys (on logout)
  public clearUserKeys(userId: string): void {
    this.userKeys.delete(userId);
  }

  // Clear chat key
  public clearChatKey(chatId: string): void {
    this.chatKeys.delete(chatId);
  }
}

export default MessageEncryption;