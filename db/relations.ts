import { relations } from "drizzle-orm"
import {
  users,
  items,
  uploads,
  shareGrants,
  shareLinks,
  accounts,
  stars,
} from "./schema"

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  accounts: many(accounts),
  grants: many(shareGrants),
}))

export const itemsRelations = relations(items, ({ one, many }) => ({
  owner: one(users, { fields: [items.ownerId], references: [users.id] }),
  parent: one(items, {
    fields: [items.parentId],
    references: [items.id],
    relationName: "children",
  }),
  children: many(items, { relationName: "children" }),
  upload: one(uploads, { fields: [items.id], references: [uploads.itemId] }),
  grants: many(shareGrants),
  links: many(shareLinks),
  stars: many(stars),
}))

export const uploadsRelations = relations(uploads, ({ one }) => ({
  item: one(items, { fields: [uploads.itemId], references: [items.id] }),
}))

export const shareGrantsRelations = relations(shareGrants, ({ one }) => ({
  item: one(items, { fields: [shareGrants.itemId], references: [items.id] }),
  user: one(users, { fields: [shareGrants.userId], references: [users.id] }),
}))

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  item: one(items, { fields: [shareLinks.itemId], references: [items.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const starsRelations = relations(stars, ({ one }) => ({
  user: one(users, { fields: [stars.userId], references: [users.id] }),
  item: one(items, { fields: [stars.itemId], references: [items.id] }),
}))
