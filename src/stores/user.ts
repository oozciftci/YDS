import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { db, ensureDefaultUsers } from '../db'
import type { UserProfile } from '../types/database'

interface UserState {
  activeUserId: string
  activeUser: UserProfile | null
  allUsers: UserProfile[]
  setActiveUser: (userId: string) => Promise<void>
  loadUsers: () => Promise<void>
  addUser: (displayName: string) => Promise<UserProfile>
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      activeUserId: 'user_ozgur',
      activeUser: null,
      allUsers: [],

      async loadUsers() {
        const users = await ensureDefaultUsers()
        const currentActiveId = get().activeUserId
        const matched =
          users.find((u) => u.id === currentActiveId) ||
          users.find((u) => u.displayName === 'Özgür') ||
          users.find((u) => u.id === 'user_osman') ||
          users[0] ||
          null

        set({
          allUsers: users,
          activeUser: matched,
          activeUserId: matched ? matched.id : 'user_ozgur',
        })
      },

      async setActiveUser(userId: string) {
        const user = await db.users.get(userId)
        if (user) {
          await db.users.update(userId, { lastActiveAt: new Date().toISOString() })
          set({ activeUserId: userId, activeUser: user })
        }
      },

      async addUser(displayName: string) {
        const id = 'user_' + crypto.randomUUID().slice(0, 8)
        const now = new Date().toISOString()
        const colors = ['#7c5cff', '#1fc8a9', '#f59e0b', '#ec4899', '#3b82f6', '#10b981']
        const randomColor = colors[Math.floor(Math.random() * colors.length)]

        const newUser: UserProfile = {
          id,
          displayName: displayName.trim(),
          avatarColor: randomColor,
          createdAt: now,
          lastActiveAt: now,
        }

        await db.users.add(newUser)
        const updated = await db.users.toArray()
        set({ allUsers: updated, activeUser: newUser, activeUserId: id })
        return newUser
      },
    }),
    {
      name: 'yds.active_user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ activeUserId: s.activeUserId }),
    },
  ),
)
