import admin from 'firebase-admin';

class FirebaseService {
  private static instance: FirebaseService;
  private app: admin.app.App | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public initialize(): void {
    if (this.app || this.isInitialized) {
      console.log('[Firebase] Already initialized, skipping...');
      return;
    }

    try {
      // Validate required environment variables
      const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
      ];
      
      const missingVars = requiredEnvVars.filter(v => !process.env[v]);
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

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

      this.isInitialized = true;
      console.log('[Firebase] Admin SDK initialized successfully for project:', process.env.FIREBASE_PROJECT_ID);
    } catch (error) {
      console.error('[Firebase] Admin initialization failed:', {
        error: error instanceof Error ? error.message : String(error),
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      });
      this.isInitialized = true; // Mark as attempted to prevent repeated errors
    }
  }

  public isReady(): boolean {
    return !!this.app;
  }

  public async sendNotification(token: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (!this.app) {
      console.error('[Firebase] Service not initialized, cannot send notification');
      return false;
    }

    if (!token) {
      console.error('[Firebase] No FCM token provided');
      return false;
    }

    try {
      console.log('[Firebase] Sending notification to token:', token.substring(0, 20) + '...');
      
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
              alert: {
                title: payload.title,
                body: payload.body
              }
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png'
          }
        }
      };

      const messageId = await admin.messaging().send(message);
      console.log('[Firebase] Notification sent successfully. Message ID:', messageId);
      return true;
    } catch (error) {
      console.error('[Firebase] Failed to send notification:', {
        token: token.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code
      });
      return false;
    }
  }

  public async sendMulticast(tokens: string[], payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app) {
      console.error('[Firebase] Service not initialized, cannot send multicast');
      return { successCount: 0, failureCount: tokens.length };
    }

    if (tokens.length === 0) {
      console.warn('[Firebase] No tokens provided for multicast notification');
      return { successCount: 0, failureCount: 0 };
    }

    try {
      console.log('[Firebase] Sending multicast notification to', tokens.length, 'devices');
      
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
              alert: {
                title: payload.title,
                body: payload.body
              }
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png'
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log('[Firebase] Multicast notification sent:', {
        success: response.successCount,
        failed: response.failureCount,
        total: tokens.length
      });

      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        response.responses
          .map((resp, idx) => ({ resp, token: tokens[idx] }))
          .filter(({ resp }) => !resp.success)
          .forEach(({ resp, token }) => {
            console.warn('[Firebase] Failed to send to token:', {
              token: token.substring(0, 20) + '...',
              error: (resp.error as Error)?.message
            });
          });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('[Firebase] Failed to send multicast notification:', {
        tokenCount: tokens.length,
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code
      });
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}

export default FirebaseService;