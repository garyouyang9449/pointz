ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "preferences" = jsonb_set("preferences", '{locationConsent}', '"granted"', true);
