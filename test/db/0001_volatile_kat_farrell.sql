CREATE UNIQUE INDEX "provider_account_id_unique_index" ON "oauth_accounts" USING btree ("provider","userId");--> statement-breakpoint
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "provider_account_unique";
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "provider_account_unique" PRIMARY KEY("provider","userId");