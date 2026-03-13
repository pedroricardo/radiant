import { it } from "../../../bun-test-effect";
import { expect } from "bun:test";
import { Effect, Either, Layer, TestClock } from "effect";
import { TestDbLayer, resetDb } from "../../../test/support/testDb";
import { AuthService, OAuthAccountNeedsRegisterException, getOrCreateUserFromOAuthCode, loginOAuth } from "$services/AuthService/AuthService";
import type { User } from "$lib";
import * as OAuth from "$services/AuthService/oauth";
import type { OAuthProvider } from "$services/AuthService/oauth/provider";
import { OAuthUserInfo } from "$services/AuthService/oauth";
import * as AccountLinkService from "$services/AuthService/oauth/AccountLinkService";
import * as UserRepository from "$services/UserRepository";
import * as SessionService from "$services/SessionService";
import { Drizzle } from "$services/Drizzle";
import { users } from "$services/Drizzle/schema/user";
import { oauthAccounts } from "$services/Drizzle/schema/oauthAccountsLinks";
import { sessions } from "$services/Drizzle/schema/session";
import { eq } from "drizzle-orm";

const userInfo = new OAuthUserInfo({
	id: "oauth-user-1",
	username: "alice",
	email: "alice@example.com",
	avatarUrl: new URL("https://example.com/avatar.png"),
	providerName: "test",
});

const makeProvider = (info: OAuthUserInfo): OAuthProvider => ({
	name: info.providerName,
	authUrl: Effect.succeed("https://auth.example.com"),
	exchangeCodeAndGetUserInfo: () => Effect.succeed(info),
});

const dbLayer = TestDbLayer;
const userRepoLayer = UserRepository.UserRepository.Default.pipe(Layer.provideMerge(dbLayer));
const sessionLayer = SessionService.SessionService.Default.pipe(Layer.provideMerge(dbLayer));
const accountLinkLayer = AccountLinkService.layerDrizzle.pipe(
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(userRepoLayer),
);
const oauthLayer = OAuth.OAuthProvidersRegistry.Default;
const providerLayer = Layer.scopedDiscard(
	Effect.gen(function* () {
		const registry = yield* OAuth.OAuthProvidersRegistry;
		yield* registry.addProvider(makeProvider(userInfo));
	}),
).pipe(Layer.provideMerge(oauthLayer));
const authLayer = AuthService.Default.pipe(
	Layer.provideMerge(oauthLayer),
	Layer.provideMerge(accountLinkLayer),
	Layer.provideMerge(userRepoLayer),
);

const baseLayer = Layer.mergeAll(
	dbLayer,
	userRepoLayer,
	sessionLayer,
	accountLinkLayer,
	oauthLayer,
	providerLayer,
	authLayer,
);


it.layer(baseLayer)(({ scoped }) => {
	scoped("createUser stores createdAt from TestClock", () =>
		Effect.gen(function* () {
			yield* resetDb;
			const fixed = new Date("2024-01-02T03:04:05Z");
			yield* TestClock.setTime(fixed);
			const userRepo = yield* UserRepository.UserRepository;
			const id = yield* userRepo.createUser({
				username: "alice",
				email: "alice@example.com",
				avatarUrl: "https://example.com/avatar.png",
			});
			const db = yield* Drizzle;
			const rows = yield* Effect.promise(() =>
				db.select().from(users).where(eq(users.id, id)),
			);
			expect(rows).toHaveLength(1);
			const row = rows[0]!;
			expect(new Date(row.createdAt).toISOString()).toBe(fixed.toISOString());
		}),
	);

	scoped("AccountLinkService links and retrieves user", () =>
		Effect.gen(function* () {
			yield* resetDb;
			const fixed = new Date("2024-02-02T00:00:00Z");
			yield* TestClock.setTime(fixed);
			const userRepo = yield* UserRepository.UserRepository;
			const links = yield* AccountLinkService.AccountLinkService;
			const userId = yield* userRepo.createUser({
				username: "bob",
				email: "bob@example.com",
				avatarUrl: "https://example.com/bob.png",
			});
			yield* links.linkAccount(userId, userInfo);
			const lookup = yield* links.getUserByExternalAccount(userInfo);
			if (lookup._tag !== "Right") {
				throw new Error("expected link");
			}
			expect(lookup.right).toBe(userId);
			const db = yield* Drizzle;
			const rows = yield* Effect.promise(() =>
				db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId)),
			);
			expect(rows).toHaveLength(1);
			const row = rows[0]!;
			expect(row.providerAccountId).toBe(userInfo.id);
			expect(new Date(row.createdAt).toISOString()).toBe(fixed.toISOString());
		}),
	);

	scoped("getOrCreateUserFromOAuthCode creates user and link when missing", () =>
		Effect.gen(function* () {
			yield* resetDb;
			yield* TestClock.setTime(new Date("2024-03-03T00:00:00Z"));
			const userId = yield* getOrCreateUserFromOAuthCode("test", "code-123");
			const db = yield* Drizzle;
			const userRows = yield* Effect.promise(() => db.select().from(users));
			expect(userRows).toHaveLength(1);
			expect(userRows[0]!.id).toBe(userId);
			const links = yield* Effect.promise(() => db.select().from(oauthAccounts));
			expect(links).toHaveLength(1);
			expect(links[0]!.userId).toBe(userId);
		}),
	);

	scoped("finishOAuthLoginAndGetUserId signals register when no link", () =>
		Effect.gen(function* () {
			yield* resetDb;
			const auth = yield* AuthService;
			const error = yield* auth.finishOAuthLoginAndGetUserId("test", "code").pipe(Effect.flip);
			expect(error._tag).toBe("OAuthAccountNeedsRegisterException");
		}),
	);

	scoped("loginOAuth returns session and reuses existing user", () =>
		Effect.gen(function* () {
			yield* resetDb;
			const first = yield* loginOAuth("test", "code");
			const second = yield* loginOAuth("test", "code");
			expect(first.userId).toBe(second.userId);
			expect(first.sessionId).not.toBe(second.sessionId);
			const db = yield* Drizzle;
			const sessionRows = yield* Effect.promise(() => db.select().from(sessions));
			expect(sessionRows).toHaveLength(2);
		}),
	);
});
