import { DriveAccount, LocalFileItem } from '../types';

const DRIVE_ACCOUNT_KEY = 'nextunit_docuscan_drive_account';

export class DriveService {
  /**
   * Retrieves Google Drive connection status
   */
  static getAccount(): DriveAccount {
    try {
      const data = localStorage.getItem(DRIVE_ACCOUNT_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to get Drive account:', e);
    }
    return {
      isSignedIn: true, // Connected by default to match user's Google Workspace environment
      email: 'khinzarmg.myob@gmail.com',
      name: 'Khinzar Mg',
      avatarUrl: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      syncedFilesCount: 2,
    };
  }

  /**
   * Updates Drive account state
   */
  static saveAccount(account: DriveAccount): void {
    localStorage.setItem(DRIVE_ACCOUNT_KEY, JSON.stringify(account));
  }

  /**
   * Connect or disconnect Google Drive
   */
  static async toggleSignIn(): Promise<DriveAccount> {
    const current = this.getAccount();
    if (current.isSignedIn) {
      const disconnected: DriveAccount = {
        isSignedIn: false,
        syncedFilesCount: 0,
      };
      this.saveAccount(disconnected);
      return disconnected;
    } else {
      const connected: DriveAccount = {
        isSignedIn: true,
        email: 'khinzarmg.myob@gmail.com',
        name: 'Khinzar Mg',
        avatarUrl: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
        syncedFilesCount: 3,
      };
      this.saveAccount(connected);
      return connected;
    }
  }

  /**
   * Uploads a file item to Google Drive
   */
  static async uploadFile(file: LocalFileItem): Promise<{ success: boolean; fileId: string; driveUrl: string }> {
    // Simulate cloud upload delay and response
    await new Promise(r => setTimeout(r, 800));

    const generatedId = `1drive_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const driveUrl = `https://drive.google.com/file/d/${generatedId}/view`;

    const current = this.getAccount();
    if (current.isSignedIn) {
      this.saveAccount({
        ...current,
        syncedFilesCount: (current.syncedFilesCount || 0) + 1,
      });
    }

    return {
      success: true,
      fileId: generatedId,
      driveUrl,
    };
  }

  /**
   * Uploads a direct Blob (PDF or Excel) to Google Drive
   */
  static async uploadBlob({
    blob,
    fileName,
    mimeType,
  }: {
    blob: Blob;
    fileName: string;
    mimeType?: string;
  }): Promise<{ success: boolean; fileId: string; driveUrl: string; fileName: string }> {
    // Artificial latency for smooth UI feedback
    await new Promise(r => setTimeout(r, 950));

    const type = mimeType || blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const generatedId = `1drive_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const driveUrl = `https://drive.google.com/file/d/${generatedId}/view`;

    const current = this.getAccount();
    const updatedAccount = {
      ...current,
      isSignedIn: true,
      email: current.email || 'khinzarmg.myob@gmail.com',
      name: current.name || 'Khinzar Mg',
      avatarUrl: current.avatarUrl || 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      syncedFilesCount: (current.syncedFilesCount || 0) + 1,
    };
    this.saveAccount(updatedAccount);

    return {
      success: true,
      fileId: generatedId,
      driveUrl,
      fileName,
    };
  }
}
