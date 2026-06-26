import { pool } from '../db/pool'

const roleRank: Record<string, number> = { admin: 4, trainer: 3, eltern: 2, mitglied: 1 }

export async function userCanAccessChannel(
  userId: string,
  userRole: string,
  channelId: string,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM channels c
     WHERE c.id = $1
       AND c.is_archived = false
       AND (
         $3 >= (CASE c.min_role
                  WHEN 'admin'   THEN 4
                  WHEN 'trainer' THEN 3
                  WHEN 'eltern'  THEN 2
                  ELSE 1 END)
         OR EXISTS (
           SELECT 1 FROM channel_members cm
           WHERE cm.channel_id = c.id AND cm.user_id = $2
         )
       )`,
    [channelId, userId, roleRank[userRole] ?? 1],
  )
  return rows.length > 0
}
