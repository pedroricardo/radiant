CREATE TABLE "oauth_states" (
	"provider" text NOT NULL,
	"state" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	CONSTRAINT "oauth_state_pk" PRIMARY KEY("provider","state")
);
