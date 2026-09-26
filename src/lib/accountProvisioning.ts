// Every account this app creates carries this in its app_metadata, which
// only the service role can write. The database trigger that makes a new
// account's profile (handle_new_user in schema.sql) takes the role and
// school from user_metadata only when it's there: anyone can sign
// themselves up through Supabase's public auth API and put whatever they
// like in user_metadata, but not in app_metadata.
export const PROVISIONED = { provisioned: true } as const;
