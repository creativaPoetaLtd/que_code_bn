import * as admin from "firebase-admin";

class FirebaseService {
  private static instance: FirebaseService;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public initialize(): void {
    if (this.initialized) {
      console.log("Firebase already initialized");
      return;
    }

    try {
      // Check if Firebase credentials are provided
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      if (!serviceAccountPath) {
        console.warn(
          "⚠️  Firebase service account path not configured. Push notifications will be disabled.",
        );
        console.warn(
          "   To enable Firebase, set FIREBASE_SERVICE_ACCOUNT_PATH in your .env file",
        );
        return;
      }

      // Initialize Firebase Admin SDK
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
      });

      this.initialized = true;
      console.log("✅ Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Firebase Admin SDK:", error);
      console.warn("   Push notifications will be disabled");
    }
  }

  public async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.initialized) {
      console.warn("Firebase not initialized. Cannot send notification.");
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        token,
        ...(data && { data }),
      };

      const response = await admin.messaging().send(message);
      console.log("Successfully sent message:", response);
      return true;
    } catch (error) {
      console.error("Error sending notification:", error);
      return false;
    }
  }

  public async sendMulticastNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      console.warn("Firebase not initialized. Cannot send notifications.");
      return { successCount: 0, failureCount: tokens.length };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        tokens,
        ...(data && { data }),
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `Successfully sent ${response.successCount} notifications, ${response.failureCount} failed`,
      );
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error("Error sending multicast notification:", error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default FirebaseService;
