CREATE TYPE "public"."plugin_instance_kind" AS ENUM('service', 'gateway');--> statement-breakpoint
CREATE TYPE "public"."plugin_lifecycle_status" AS ENUM('installed', 'disabled', 'enabled', 'started', 'error');--> statement-breakpoint
CREATE TYPE "public"."plugin_type" AS ENUM('service', 'gateway', 'panel');--> statement-breakpoint
CREATE TABLE "plugin_installs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "plugin_type" NOT NULL,
	"version" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" "plugin_lifecycle_status" DEFAULT 'installed' NOT NULL,
	"error" text,
	"discovered_path" text,
	"content_hash" text,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" text NOT NULL,
	"kind" "plugin_instance_kind" NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_kv" (
	"plugin_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_kv_plugin_id_key_pk" PRIMARY KEY("plugin_id","key")
);
--> statement-breakpoint
CREATE TABLE "plugin_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" text NOT NULL,
	"instance_id" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugin_instances" ADD CONSTRAINT "plugin_instances_plugin_id_plugin_installs_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugin_installs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plugin_instances_plugin_id_idx" ON "plugin_instances" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_kv_plugin_id_idx" ON "plugin_kv" USING btree ("plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_secrets_plugin_instance_key_idx" ON "plugin_secrets" USING btree ("plugin_id","instance_id","key");--> statement-breakpoint
CREATE INDEX "plugin_secrets_plugin_id_idx" ON "plugin_secrets" USING btree ("plugin_id");