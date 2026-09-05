# SalesQL API — documentación ajustada

> Documento consolidado a partir de la documentación pública de SalesQL y del contenido textual proporcionado para los endpoints prioritarios.
>
> Para los endpoints detallados a continuación se preserva la estructura funcional indicada en la documentación: criterios de búsqueda, grupos de parámetros, parámetros opcionales, respuestas y ejemplos de uso.

## Base URL

```text
https://api-public.salesql.com/v1
```

## Autenticación

Los endpoints requieren autenticación mediante Bearer token:

```http
Authorization: Bearer YOUR_SECRET_TOKEN
```

---

# Enrich Organization

```http
GET /v1/organizations/enrich
```

**Auth Required**

Retrieve enriched data for an organization.

You must provide **one** of the following search criteria:

- `linkedin_url` — LinkedIn company URL  
  Example: `https://linkedin.com/company/siemens`
- `organization_name` — Exact or partial organization name
- `organization_domain` — Website domain  
  Example: `siemens.com`

## Query Parameters

### `linkedin_url`

**Type:** `string`  
**Format:** `uri`

LinkedIn URL of the organization.

Example:

```text
https://linkedin.com/company/siemens
```

### `organization_name`

**Type:** `string`

Name of the organization.

### `organization_domain`

**Type:** `string`

Domain of the organization.

Example:

```text
siemens.com
```

## Responses

### `200`

Organization Enrichment Response.

**Content-Type:**

```text
application/json
```

### `400`

Bad Request — The request was invalid or cannot be served.

**Content-Type:**

```text
application/json
```

### `401`

Unauthorized — the API key is missing, unknown or revoked.

`error` is a stable, machine-readable code:

- `invalid_key` — the key was not recognized. This also covers an expired key: expiration is enforced by the key's native TTL, so an expired key is evicted and no longer resolves.
- `key_revoked` — the key exists but has been revoked.

**Content-Type:**

```text
application/json
```

### `403`

Forbidden — the API key is valid and active, but not allowed to call this endpoint.

`error` is a stable, machine-readable code:

- `invalid_key_type` — the key's type is not allowed on this route.
- `missing_scope` — the key does not have the scope this route requires. The required scope is only present for `missing_scope`.

**Content-Type:**

```text
application/json
```

### `404`

Not Found — The organization was not found.

**Content-Type:**

```text
application/json
```

### `422`

Missing Parameters — The request is missing required parameters.

**Content-Type:**

```text
application/json
```

### `429`

Rate Limit Exceeded — Too many requests.

## Shell example

```bash
curl 'https://api-public.salesql.com/v1/organizations/enrich?linkedin_url=https%3A%2F%2Flinkedin.com%2Fcompany%2Fsiemens&organization_name=&organization_domain=siemens.com' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
```

---

# Enrich Person

```http
GET /v1/persons/enrich
```

**Auth Required**

Retrieve enriched data for a person.

Query parameters work in **groups** — you must provide a complete group.

## Group 1 — LinkedIn URL

```text
linkedin_url
```

Example:

```text
https://linkedin.com/in/ryanlincoln
```

## Group 2 — Email

```text
email
```

Example:

```text
catherinelkent@gmail.com
```

## Group 3 — Name + Organization

Accepted combinations:

```text
first_name + last_name + organization_name
first_name + last_name + organization_domain
full_name + organization_name
full_name + organization_domain
```

## Optional flags

### `match_if_direct_email`

Require a direct (non-work) email.

### `match_if_direct_phone`

Require a direct phone number.

## Recommended matching strategy

| Priority | Parameters | Notes |
|---|---|---|
| ⭐ | `linkedin_url` | Highest accuracy, unique identifier |
| — | `email` | Direct lookup by email address |
| — | `full_name + organization_domain` | Reliable when LinkedIn URL is unavailable |
| — | `first_name + last_name + organization_name` | Use only when domain is unknown |

## Query Parameters

### `linkedin_url`

**Type:** `string`  
**Format:** `uri`

LinkedIn URL of the person.

Example:

```text
https://linkedin.com/in/ryanlincoln
```

### `email`

**Type:** `string`  
**Format:** `email`

Email address of the person.

Example:

```text
catherinelkent@gmail.com
```

### `first_name`

**Type:** `string`

First name of the person.

### `last_name`

**Type:** `string`

Last name of the person.

### `full_name`

**Type:** `string`

Full name of the person.

### `organization_name`

**Type:** `string`

Name of the person's organization.

### `organization_domain`

**Type:** `string`

Domain of the person's organization.

### `match_if_direct_email`

**Type:** `boolean`

**Default:** as documented in the API reference.

Require a direct (non-work) email address in the response.

### `match_if_direct_phone`

**Type:** `boolean`

**Default:** as documented in the API reference.

Require a direct phone number in the response.

## Responses

### `200`

Person Enrichment Response.

**Content-Type:**

```text
application/json
```

### `400`

Bad Request — The request was invalid or cannot be served.

**Content-Type:**

```text
application/json
```

### `401`

Unauthorized — the API key is missing, unknown or revoked.

`error` is a stable, machine-readable code:

- `invalid_key` — the key was not recognized. This also covers an expired key: expiration is enforced by the key's native TTL, so an expired key is evicted and no longer resolves.
- `key_revoked` — the key exists but has been revoked.

**Content-Type:**

```text
application/json
```

### `403`

Forbidden — the API key is valid and active, but not allowed to call this endpoint.

`error` is a stable, machine-readable code:

- `invalid_key_type` — the key's type is not allowed on this route.
- `missing_scope` — the key does not have the scope this route requires. The required scope is only present for `missing_scope`.

**Content-Type:**

```text
application/json
```

### `404`

Not Found — The person was not found.

**Content-Type:**

```text
application/json
```

### `422`

Missing Parameters — The request is missing required parameters.

**Content-Type:**

```text
application/json
```

### `429`

Rate Limit Exceeded — Too many requests.

## Shell example

```bash
curl 'https://api-public.salesql.com/v1/persons/enrich?linkedin_url=https%3A%2F%2Flinkedin.com%2Fin%2Fryanlincoln&email=catherinelkent%40gmail.com&first_name=&last_name=&full_name=&organization_name=&organization_domain=&match_if_direct_email=false&match_if_direct_phone=false' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
```

> Aunque el ejemplo de la documentación incluye múltiples parámetros a la vez, la descripción funcional indica que los criterios de búsqueda trabajan por grupos y que debe proporcionarse un grupo completo.

---

# Email Lookup Person

```http
GET /v1/persons/email_lookup
```

**Auth Required**

Retrieve enriched data for a person using their email address.

This endpoint is functionally equivalent to:

```http
GET /v1/persons/enrich?email=...
```

and shares the same rate-limit and allowance bucket.

## Query Parameters

### `email`

**Type:** `string`  
**Format:** `email`  
**Required:** yes

Email address of the person.

Example:

```text
catherinelkent@gmail.com
```

## Responses

### `200`

Person Enrichment Response.

**Content-Type:**

```text
application/json
```

### `400`

Bad Request — The request was invalid or cannot be served.

**Content-Type:**

```text
application/json
```

### `401`

Unauthorized — the API key is missing, unknown or revoked.

`error` is a stable, machine-readable code:

- `invalid_key` — the key was not recognized. This also covers an expired key: expiration is enforced by the key's native TTL, so an expired key is evicted and no longer resolves.
- `key_revoked` — the key exists but has been revoked.

**Content-Type:**

```text
application/json
```

### `404`

Not Found — The person was not found.

**Content-Type:**

```text
application/json
```

### `422`

Missing Parameters — The request is missing required parameters.

**Content-Type:**

```text
application/json
```

### `429`

Rate Limit Exceeded — Too many requests.

## Shell example

```bash
curl 'https://api-public.salesql.com/v1/persons/email_lookup?email=catherinelkent%40gmail.com' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
```

---

# Resumen de endpoints prioritarios

| Endpoint | Método | Uso |
|---|---|---|
| `/v1/organizations/enrich` | `GET` | Enriquecer una organización |
| `/v1/persons/enrich` | `GET` | Enriquecer una persona mediante LinkedIn, email o nombre + organización |
| `/v1/persons/email_lookup` | `GET` | Buscar/enriquecer una persona directamente por email |

---

# Resumen de criterios de matching

## Organization

Se debe enviar **uno** de:

```text
linkedin_url
organization_name
organization_domain
```

## Person

Se debe enviar **un grupo completo**:

```text
linkedin_url
```

o:

```text
email
```

o alguna de estas combinaciones:

```text
first_name + last_name + organization_name
first_name + last_name + organization_domain
full_name + organization_name
full_name + organization_domain
```

Flags opcionales:

```text
match_if_direct_email
match_if_direct_phone
```

## Email Lookup

Requiere:

```text
email
```
