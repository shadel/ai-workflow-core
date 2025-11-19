# Backend API Rules

**Purpose**: Rules for REST/GraphQL APIs, microservices  
**Applicability**: ~35% of projects (backend APIs)  
**Usage**: Activate if building backend API

---

## RULE-API-001: Endpoint Response Validation

**The Rule**: Every API endpoint must validate response structure and status codes.

**Actions**:
```javascript
For EACH endpoint:
1. ✅ Test happy path (200/201)
2. ✅ Test error cases (400/401/403/404/500)
3. ✅ Validate response schema
4. ✅ Check response time < 200ms
```

**Activation**: `npx ai-workflow activate api-001`

---

## RULE-API-002: Rate Limiting Required

**The Rule**: All public endpoints must have rate limiting.

**Actions**:
```
1. ✅ Define rate limits (e.g., 100 req/min)
2. ✅ Implement middleware
3. ✅ Return 429 when exceeded
4. ✅ Document limits in API docs
```

**Activation**: `npx ai-workflow activate api-002`

---

## RULE-API-003: API Versioning

**The Rule**: Use versioning for all endpoints (/api/v1/...).

**Why**: Prevents breaking changes for existing clients.

**Activation**: `npx ai-workflow activate api-003`

---

**Activate all**: `npx ai-workflow activate-all api`

