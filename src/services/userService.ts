import { AppUser } from '../types';

const STORAGE_KEY_USERS = 'nextunit_docuscan_users';
const STORAGE_KEY_CURRENT_USER = 'nextunit_docuscan_current_user_id';

const SEED_USERS: AppUser[] = [
  {
    id: 'user-admin-1',
    name: 'Admin Manager (HQ)',
    email: 'admin@nextunit.io',
    role: 'admin',
    branch: 'Headquarters (Main)',
    status: 'active',
    createdAt: '2026-01-15T08:30:00.000Z',
    avatarColor: 'bg-emerald-600',
  },
  {
    id: 'user-normal-1',
    name: 'Khinzar (Yangon Branch)',
    email: 'khinzar@nextunit.io',
    role: 'normal',
    branch: 'Yangon Branch',
    status: 'active',
    createdAt: '2026-02-01T09:00:00.000Z',
    avatarColor: 'bg-blue-600',
  },
  {
    id: 'user-normal-2',
    name: 'Ko Min (Mandalay Branch)',
    email: 'komin@nextunit.io',
    role: 'normal',
    branch: 'Mandalay Branch',
    status: 'active',
    createdAt: '2026-02-10T11:20:00.000Z',
    avatarColor: 'bg-purple-600',
  },
  {
    id: 'user-normal-3',
    name: 'Su Su (Naypyitaw Branch)',
    email: 'susu@nextunit.io',
    role: 'normal',
    branch: 'Naypyitaw Branch',
    status: 'active',
    createdAt: '2026-03-05T14:15:00.000Z',
    avatarColor: 'bg-amber-600',
  },
];

export class UserService {
  /**
   * Retrieves all users from storage
   */
  static getUsers(): AppUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      if (data) {
        const parsed: AppUser[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
    this.saveUsers(SEED_USERS);
    return SEED_USERS;
  }

  /**
   * Saves users to storage
   */
  static saveUsers(users: AppUser[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users:', e);
    }
  }

  /**
   * Retrieves the currently active user
   */
  static getCurrentUser(): AppUser {
    const users = this.getUsers();
    try {
      const currentId = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (currentId) {
        const found = users.find(u => u.id === currentId && u.status === 'active');
        if (found) return found;
      }
    } catch (e) {
      console.error('Failed to get current user:', e);
    }
    // Default to admin user for convenient management & demonstration
    const defaultUser = users.find(u => u.role === 'admin') || users[0];
    this.setCurrentUser(defaultUser.id);
    return defaultUser;
  }

  /**
   * Switches the active user
   */
  static setCurrentUser(userId: string): AppUser | null {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (target) {
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, target.id);
      } catch (e) {
        console.error('Failed to save current user id:', e);
      }
      return target;
    }
    return null;
  }

  /**
   * Creates a new user
   */
  static addUser(user: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = this.getUsers();
    const colors = ['bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: AppUser = {
      ...user,
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      avatarColor: user.avatarColor || randomColor,
    };

    const updated = [...users, newUser];
    this.saveUsers(updated);
    return newUser;
  }

  /**
   * Updates an existing user
   */
  static updateUser(id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>): AppUser[] {
    const users = this.getUsers();
    const updated = users.map(u => (u.id === id ? { ...u, ...updates } : u));
    this.saveUsers(updated);
    return updated;
  }

  /**
   * Deletes a user
   */
  static deleteUser(id: string): AppUser[] {
    const users = this.getUsers();
    const updated = users.filter(u => u.id !== id);
    this.saveUsers(updated);
    return updated;
  }
}
