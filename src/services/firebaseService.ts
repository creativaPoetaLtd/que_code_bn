import admin from 'firebase-admin';

class FirebaseService {
  private static instance: FirebaseService;
  private app: admin.app.App | null = null;

  private constructor() {}

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public initialize(): void {
    if (this.app) return;

    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
          };

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
    }
  }

  public async sendNotification(token: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (!this.app) {
      console.error('Firebase not initialized');
      return false;
    }

    try {
      const message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      await admin.messaging().send(message);
      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  public async sendMulticast(tokens: string[], payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length };
    }

    try {
      const message = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Failed to send multicast notification:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}

export default FirebaseService;