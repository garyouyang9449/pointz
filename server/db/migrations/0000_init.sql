CREATE TABLE IF NOT EXISTS "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"name" text NOT NULL,
	"network" text,
	"annual_fee" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"category" text NOT NULL,
	"rate" numeric NOT NULL,
	"reward_type" text NOT NULL,
	"cap_amount" numeric,
	"cap_period" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_owned_cards" (
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_owned_cards_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "reward_rules" ADD CONSTRAINT "reward_rules_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_owned_cards" ADD CONSTRAINT "user_owned_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_owned_cards" ADD CONSTRAINT "user_owned_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
