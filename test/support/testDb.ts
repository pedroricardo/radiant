import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/bun-sql";
import { Drizzle } from "$services/Drizzle";
import { Clock, Context, Data, Effect, Exit, Layer, Schedule } from "effect";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { AbstractWaitStrategy } from "testcontainers/build/wait-strategies/wait-strategy";
import { GenericContainer, type BoundPorts } from "testcontainers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Sql = SQL;
export class TestSql extends Context.Tag("TestSql")<TestSql, Sql>() {}

export class StartContainerError extends Data.TaggedError("TestDbStartContainerError")<{ cause: unknown }> {}
export class WaitForDbReadyError extends Data.TaggedError("TestDbWaitForReadyError")<{ cause: unknown }> {}
export class MigrationSqlError extends Data.TaggedError("TestDbMigrationSqlError")<{ cause: unknown; file?: string }> {}
export class ResetDbError extends Data.TaggedError("TestDbResetError")<{ cause: unknown }> {}

const runMigrationsDir = (sql: Sql) =>
	Effect.gen(function* () {
		const migrationsDir = path.resolve(__dirname, "../db");
		const files = yield* Effect.tryPromise({
			try: () => fs.readdir(migrationsDir),
			catch: (cause) => new MigrationSqlError({ cause }),
		});
		const sorted = files
			.filter((f) => f.endsWith(".sql"))
			.sort((a, b) => a.localeCompare(b));
		for (const file of sorted) {
			const filePath = path.join(migrationsDir, file);
			const sqlText = yield* Effect.tryPromise({
				try: () => fs.readFile(filePath, "utf8"),
				catch: (cause) => new MigrationSqlError({ cause, file: filePath }),
			});
			yield* Effect.log(`Running migration ${filePath}`);

			yield* Effect.tryPromise({
				try: () => sql.unsafe(sqlText),
				catch: (cause) => new MigrationSqlError({ cause, file: filePath }),
			}).pipe(Effect.tapError(e => Effect.logError(`Migration ${file} failed to run`)));
			yield* Effect.log(`Migration ${file} completed`);

		}
	});

const waitForReady = (sql: Sql) =>
	Effect.tryPromise({
		try: () => sql`select 1`,
		catch: (cause) => new WaitForDbReadyError({ cause }),
	}).pipe(
		Effect.retry({ schedule: Schedule.spaced("500 millis"), times: 10 }),
		Effect.provide(Layer.setClock(Clock.make())),
	);

const sqlLayer = Layer.scoped(
	TestSql,
	Effect.acquireRelease(
		Effect.gen(function* () {
			class NoWaitingStrategy extends AbstractWaitStrategy {
				async waitUntilReady(_container: unknown, _boundPorts: BoundPorts, _startTime?: Date): Promise<void> {}
			}
			const container = yield* Effect.tryPromise({
				try: () => new GenericContainer("postgres")
						.withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_USER: "postgres", POSTGRES_DB: "postgres" })
						.withReuse()
						.withExposedPorts(5432)
						.withHealthCheck({
							test: ["CMD-SHELL", "pg_isready -U postgres"],
							interval: 1000,
							timeout: 5000,
							retries: 10,
						})
						.withWaitStrategy(new NoWaitingStrategy()).start(),
				catch: (cause) => new StartContainerError({ cause }),
			});
			yield* Effect.log(`Started container ${container.getId()}`);

			const baseDBUrl = `postgresql://postgres:test@localhost:${container.getMappedPort(5432)}`;
			yield* Effect.log(`Base DB URL: ${baseDBUrl}`);
			const bootstrapDBUrl = `${baseDBUrl}/postgres`;
			const bootstrapDBConnection = new Bun.SQL(bootstrapDBUrl);
			yield* waitForReady(bootstrapDBConnection);
			const randomDatabaseName = `test_${Bun.randomUUIDv7().replace(/-/g, "")}`;

			yield* Effect.log(`Creating test database ${randomDatabaseName}`);
			yield* Effect.tryPromise(() =>
				bootstrapDBConnection`CREATE DATABASE ${Bun.sql(randomDatabaseName)}`.then(() => bootstrapDBConnection.close({ timeout: 0 })),
			)
			const databaseUrl = `${baseDBUrl}/${randomDatabaseName}`;

			const sql = new SQL(databaseUrl);
			yield* runMigrationsDir(sql);
			return { sql, container, bootstrapDBConnection, randomDatabaseName };
		}),
		({ sql, container, bootstrapDBConnection, randomDatabaseName }) =>
			Effect.tryPromise(async () => {
				try {
					await sql.close();
					await bootstrapDBConnection`DROP DATABASE ${sql(randomDatabaseName)}`;
				} finally {
					await bootstrapDBConnection.close();
				}
			}).pipe(Effect.ignoreLogged),
	).pipe(Effect.map(({ sql, randomDatabaseName }) => sql)),
);

const drizzleLayer = Layer.effect(
	Drizzle,
	Effect.flatMap(TestSql, (sql) => Effect.sync(() => drizzle(sql))),
).pipe(Layer.provideMerge(sqlLayer));

export const TestDbLayer = Layer.mergeAll(sqlLayer, drizzleLayer);

export const resetDb = TestSql.pipe(
	Effect.flatMap((sql) =>
		Effect.gen(function* () {
			yield* Effect.tryPromise({
				try: () =>
					sql.unsafe(`
DO $$
    DECLARE
        statements CURSOR FOR
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public';
    BEGIN
        FOR stmt IN statements LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(stmt.tablename) || ' CASCADE;';
        END LOOP;
    END;
$$;
`),
				catch: (cause) => new ResetDbError({ cause }),
			});
		}),
	),
	Effect.asVoid,
);
