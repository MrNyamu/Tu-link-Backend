CREATE TYPE "public"."saved_route_source" AS ENUM('COMPUTED', 'RECORDED', 'MANUAL');--> statement-breakpoint
CREATE TABLE "saved_route_editors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_route_id" uuid NOT NULL,
	"user_id" text,
	"clerk_user_id" text,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_route_editors_mobile_unique" UNIQUE("saved_route_id","user_id"),
	CONSTRAINT "saved_route_editors_clerk_unique" UNIQUE("saved_route_id","clerk_user_id"),
	CONSTRAINT "saved_route_editors_one_identity" CHECK (num_nonnulls("saved_route_editors"."user_id", "saved_route_editors"."clerk_user_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "saved_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" "saved_route_source" NOT NULL,
	"geometry" jsonb NOT NULL,
	"waypoints" jsonb NOT NULL,
	"distance_metres" double precision NOT NULL,
	"duration_seconds" double precision,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text,
	"created_by_clerk_user_id" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_route_editors" ADD CONSTRAINT "saved_route_editors_saved_route_id_saved_routes_id_fk" FOREIGN KEY ("saved_route_id") REFERENCES "public"."saved_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_route_editors" ADD CONSTRAINT "saved_route_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_routes" ADD CONSTRAINT "saved_routes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_routes" ADD CONSTRAINT "saved_routes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_saved_route_editors_route" ON "saved_route_editors" USING btree ("saved_route_id");--> statement-breakpoint
CREATE INDEX "idx_saved_routes_organization" ON "saved_routes" USING btree ("organization_id","is_archived","updated_at");