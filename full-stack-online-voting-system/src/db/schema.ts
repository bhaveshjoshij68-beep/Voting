import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  party: text("party").notNull().default("Independent"),
  slogan: text("slogan").notNull().default(""),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const voters = pgTable("voters", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  department: text("department").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  voterName: text("voter_name").notNull(),
  voterEmail: text("voter_email").unique(),
  voterPhone: text("voter_phone"),
  studentId: text("student_id").unique(),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  receiptCode: text("receipt_code").notNull().unique(),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
