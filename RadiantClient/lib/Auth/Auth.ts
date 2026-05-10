import {
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiSchema,
	HttpApiSecurity,
} from "@effect/platform"
import { Context, Schema } from "effect"
import * as Session from "../Session"
import * as User from "../User"

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
	"Unauthorized",
	{},
	HttpApiSchema.annotations({ status: 401 }),
) {}

export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User.UserId>() {}
export const security = {
	bearer: HttpApiSecurity.bearer,
	cookie: HttpApiSecurity.apiKey({
		key: "session_id",
		in: "cookie",
	}),
}
export class Authorization extends HttpApiMiddleware.Tag<Authorization>()("Authorization", {
	failure: Unauthorized,
	provides: CurrentUser,
	security,
}) {}

export class OAuthProviderNotFound extends Schema.TaggedError<OAuthProviderNotFound>()(
	"OAuthProviderNotFound",
	{
		got: Schema.String,
		availableProviders: Schema.Array(Schema.String),
	},
	HttpApiSchema.annotations({ status: 404 }),
) {}
// MultiplexerError | EncodingError
export class OAuthLoginFailed extends Schema.TaggedError<OAuthLoginFailed>()(
	"OAuthLoginFailed",
	{ message: Schema.String },
	HttpApiSchema.annotations({ status: 400 }),
) {}

export class OAuthAuthorizationUrlFailed extends Schema.TaggedError<OAuthAuthorizationUrlFailed>()(
	"OAuthAuthorizationUrlFailed",
	{ message: Schema.String },
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class OAuthInvalidState extends Schema.TaggedError<OAuthInvalidState>()(
	"OAuthInvalidState",
	{},
	HttpApiSchema.annotations({ status: 400 }),
) {}

const ProviderParam = HttpApiSchema.param("provider", Schema.String)

const OAuthCallbackUrlParams = Schema.Struct({
	code: Schema.String,
	state: Schema.String,
})

const OAuthLoginResponse = Schema.Struct({
	sessionId: Session.SessionId,
	userId: User.UserId,
})

export const authGroup = HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.get("listOAuthProviders")`/oauth/providers`.addSuccess(
			Schema.Array(Schema.String),
		),
	)
	.add(
		HttpApiEndpoint.get("getOAuthAuthorizationUrl")`/oauth/${ProviderParam}/url`
			.addSuccess(Schema.String)
			.addError(OAuthProviderNotFound)
			.addError(OAuthAuthorizationUrlFailed),
	)
	.add(
		HttpApiEndpoint.get("oauthCallback")`/oauth/${ProviderParam}/callback`
			.setUrlParams(OAuthCallbackUrlParams)
			.addSuccess(OAuthLoginResponse)
			.addError(OAuthProviderNotFound)
			.addError(OAuthLoginFailed)
			.addError(OAuthInvalidState),
	)
	.prefix("/auth")
