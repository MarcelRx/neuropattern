# MongoDB Configuration Guide

## Overview

NeuroPattern uses MongoDB as its primary database. This document explains authentication, access control, and connection configuration for local development and production deployments.

## Authentication Strategy

### Development Environment

For local development, MongoDB can run with authentication enabled using credentials configured through environment variables.

The default Docker Compose configuration may provide the following development-only defaults:

- **Root User:** `root`
- **Root Password:** `changeme`
- **Application User:** `neuropattern_app`
- **Application Password:** `app_changeme_in_production`

**Warning:** These values are insecure development defaults. Override them with unique credentials before starting the application whenever possible. Never use these defaults in production or expose a MongoDB instance configured with them to an untrusted network.

### Production Environment

For production deployments, follow these practices:

1. **Use Application Credentials:** Configure the backend to use a dedicated application database user instead of root credentials.
2. **Replace Default Passwords:** Use strong, unique credentials for every environment.
3. **Consider MongoDB Atlas:** Use a managed database service when appropriate for your deployment.
4. **Enable TLS:** Encrypt database connections and validate server certificates.
5. **Restrict Network Access:** Keep MongoDB on a private network and allow connections only from trusted application services.
6. **Store Secrets Securely:** Use a deployment secret manager or protected environment variables. Never commit real credentials to version control.

## User Roles

### Root User

- **Role:** `root` on the `admin` database.
- **Privileges:** Broad administrative access to the MongoDB deployment.
- **Usage:** Database administration and initialization tasks.
- **Backend Usage:** Do not use root credentials for routine application database operations in production.

### Application User (`neuropattern_app`)

- **Role:** `readWrite` on the `neuropattern` database.
- **Privileges:** Read and write access to the application database.
- **Usage:** Routine application database operations.
- **Backend Usage:** Use a dedicated application account with only the permissions the application requires.

## Configuration

### Docker Compose (Local Development)

The `docker-compose.yml` file may configure MongoDB using environment variables such as:

```yaml
environment:
  MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME:-root}
  MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD:-changeme}
  MONGO_INITDB_DATABASE: neuropattern
  MONGO_APP_USER: ${MONGO_APP_USER:-neuropattern_app}
  MONGO_APP_PASSWORD: ${MONGO_APP_PASSWORD:-app_changeme_in_production}
```

These defaults are intended only for local development. Confirm the actual variable names and initialization behavior in the repository's Docker Compose and MongoDB initialization files before changing deployment configuration.

To override the defaults, create a local `.env` file:

```env
MONGO_INITDB_ROOT_USERNAME=your_root_user
MONGO_INITDB_ROOT_PASSWORD=replace_with_a_unique_secret
MONGO_APP_USER=neuropattern_app
MONGO_APP_PASSWORD=replace_with_a_different_unique_secret
```

Use actual secret values only in your local environment or deployment secret manager. Do not commit `.env` files or real credentials to Git.

### Backend Configuration

The backend supports the following connection configuration patterns, depending on the application's environment and settings.

#### 1. Full Connection String (`MONGODB_URI`)

Set `MONGODB_URI` to the connection string for your environment. For example, use a nonfunctional placeholder in documentation:

```env
MONGODB_URI=mongodb://<username>:<password>@<host>:27017/<database>?authSource=<auth-database>
```

Replace the placeholders locally with the appropriate connection details. Do not paste real connection strings into documentation, source code, issue reports, or public repositories.

#### 2. Component Variables

Alternatively, configure the database connection using separate environment variables:

```env
DB_HOST=mongodb
DB_PORT=27017
DB_NAME=neuropattern
DB_USER=neuropattern_app
DB_PASSWORD=replace_with_a_unique_secret
```

The backend's `database.py` module determines how these settings are used. According to the repository configuration, the intended priority is:

1. A full `MONGODB_URI`, when provided.
2. Component variables such as `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
3. Unauthenticated local development, only if explicitly supported by the application configuration.

Verify the implementation in `backend/app/database.py` and the configuration module before relying on this priority in production. Production deployments must fail safely if required credentials or secure connection settings are missing.

## Initialization Script

The `mongo-init.js` script is intended to run during the initial creation of the MongoDB data directory. Its behavior depends on the MongoDB image and the repository's initialization configuration.

The intended initialization tasks are:

1. Prepare the `neuropattern` database.
2. Create the application user with `readWrite` access to the `neuropattern` database.
3. Handle initialization according to the script's actual user-existence and error-handling logic.

**Important:** MongoDB container initialization scripts generally run only when the database data directory is first initialized. Changing environment variables later does not automatically update users or passwords already stored in an existing database.

If credentials change, update the database user's credentials through an appropriate authenticated administrative process. Do not delete a database volume merely to apply a password change.

If you intentionally need to recreate a local development database, first verify that all required data has been backed up and that the target volume is correct. Removing a volume permanently deletes the data stored in it.

## Security Recommendations

### For Production

1. **Use Strong, Unique Passwords**
   - Use long, randomly generated secrets.
   - Use different credentials for separate environments and services.
   - Rotate credentials when they may have been exposed.

2. **Use Least-Privilege Application Accounts**
   - Use a dedicated application user.
   - Grant only the database roles required by the application.
   - Never embed root credentials in application code.

3. **Require Authentication**
   - Never expose an unauthenticated MongoDB instance to untrusted networks.
   - Use the authentication mechanisms supported by your MongoDB deployment.

4. **Enable TLS**
   - Encrypt database connections.
   - Use valid certificates.
   - Validate server certificates rather than disabling certificate checks.

5. **Restrict Network Access**
   - Keep MongoDB on a private network when possible.
   - Apply firewall rules and Atlas network access restrictions.
   - Do not expose port `27017` publicly unless there is a specific, secured requirement.

6. **Maintain Backups**
   - Configure automated backups.
   - Test restoration procedures.
   - Protect backup data and access credentials.

7. **Monitor Access**
   - Enable appropriate database logging and auditing.
   - Monitor failed authentication attempts and unusual access patterns.
   - Configure alerts for suspicious activity.

8. **Manage Secrets Safely**
   - Store production secrets in a secret manager or protected deployment settings.
   - Keep real `.env` files out of version control.
   - Review repository history and rotate any credentials that may have been committed publicly.

### For Local Development

1. Override insecure default credentials in `.env`.
2. Never commit `.env` or other files containing real secrets.
3. Use separate credentials for different projects and environments.
4. Keep database ports bound to localhost or an appropriately restricted network.
5. Use authentication in development when practical.
6. Avoid sharing terminal output that contains connection strings or credentials.

## Troubleshooting

### Authentication Failed

If MongoDB reports an authentication error:

1. Verify the configured username and password in the local environment or deployment settings.
2. Confirm that the user exists and has the required roles.
3. Check that `authSource` identifies the database where the user was created.
4. Verify that the backend is using the expected connection string and has not loaded stale environment variables.

For an authenticated administrative session, inspect users with appropriate privileges:

```javascript
use neuropattern
db.getUsers()
```

Do not include passwords or full connection strings in diagnostic output.

### Connection Refused

If the backend cannot connect to MongoDB:

1. Verify the MongoDB service is running:

   ```bash
   docker compose ps mongodb
   ```

2. Inspect the relevant container logs:

   ```bash
   docker compose logs --tail=100 mongodb
   ```

3. Confirm the configured hostname and port are correct for the application's network.
4. Verify that the database service and backend share the intended Docker network.
5. Check local port usage if connecting through a published port:

   ```bash
   lsof -i :27017
   ```

6. For MongoDB Atlas, verify the cluster is available and the application's source IP is allowed by the network access rules.

### Volume Reuse Issues

If changes to initialization environment variables do not take effect:

1. Check whether the MongoDB data directory already contains an initialized database.
2. Update existing database users through an authenticated administrative process if credentials need to change.
3. Restart services only when necessary and after considering application impact.
4. Recreate a local development volume only when intentionally resetting the database and after verifying that its data can be discarded.

**Warning:** Removing a MongoDB volume deletes its stored data. Never run a volume-removal command in production as a routine credential-rotation step.

## MongoDB Atlas (Cloud)

For production deployments, consider MongoDB Atlas:

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a cluster.
3. Create a dedicated database user with the minimum permissions required on the `neuropattern` database.
4. Configure network access to allow only trusted application sources.
5. Retrieve the connection string from the Atlas dashboard.
6. Store the connection string in a protected environment variable or secret manager.
7. Enable TLS and use the connection settings recommended by Atlas.
8. Verify connectivity from the actual deployment environment.

Use the following nonfunctional template in documentation:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
```

Replace the placeholders only in your private environment configuration. The template above is illustrative and is not a usable database connection string.

## Security Incident Response

If a real database password, connection string, API key, or other secret is committed to a public repository:

1. Revoke or rotate the affected credential immediately.
2. Check database access logs for unexpected activity.
3. Remove the exposed value from the current source files.
4. Review the Git history and other copies of the repository where the secret may remain.
5. Follow the repository's secret-scanning alert workflow and resolve the alert only after verifying that the credential is no longer valid and the exposure has been addressed.
6. Add preventive secret scanning and appropriate CI checks to reduce the risk of future incidents.

Removing a secret from the latest commit does not invalidate it and does not remove it from older Git objects or existing clones. Credential rotation is the essential first step when a real secret may have been exposed.
