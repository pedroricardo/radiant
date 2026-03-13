import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiSchema,
	HttpApiSecurity,
} from "@effect/platform"
import { Context, Schema } from "effect"
import { Session, User, User as UserDomain } from "./lib"


const idParam = HttpApiSchema.param("id", Schema.NumberFromString)

const usersGroup = HttpApiGroup.make("users").add(
	HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User.User),
)

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
	"Unauthorized",
	{},
	HttpApiSchema.annotations({ status: 401 }),
) {}
export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, UserDomain.UserId>() {}
export class Authorization extends HttpApiMiddleware.Tag<Authorization>()("Authorization", {
	failure: Unauthorized,
	provides: CurrentUser,
	security: {
		bearer: HttpApiSecurity.bearer,
	},
}) {}

export class OAuthProviderNotFound extends Schema.TaggedError<OAuthProviderNotFound>()(
	"OAuthProviderNotFound",
	{
		got: Schema.String,
		availableProviders: Schema.Array(Schema.String),
	},
	HttpApiSchema.annotations({ status: 404 }),
) {}

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
	userId: UserDomain.UserId,
})

const MeResponse = Schema.Struct({
	userId: UserDomain.UserId,
})

const authGroup = HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.get("listOAuthProviders")`/auth/oauth/providers`.addSuccess(
			Schema.Array(Schema.String),
		),
	)
	.add(
		HttpApiEndpoint.get("getOAuthAuthorizationUrl")`/auth/oauth/${ProviderParam}/url`.addSuccess(
			Schema.String,
		)
			.addError(OAuthProviderNotFound)
			.addError(OAuthAuthorizationUrlFailed),
	)
	.add(
		HttpApiEndpoint.get("oauthCallback")`/auth/oauth/${ProviderParam}/callback`
			.setUrlParams(OAuthCallbackUrlParams)
			.addSuccess(OAuthLoginResponse)
			.addError(OAuthProviderNotFound)
			.addError(OAuthLoginFailed)
			.addError(OAuthInvalidState),
	)
	.add(
		HttpApiEndpoint.get("me")`/me`
			.addSuccess(MeResponse)
			.middleware(Authorization),
	)

export const httpApi = HttpApi.make("radiant").add(usersGroup).add(authGroup)
