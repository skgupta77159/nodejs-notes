# 16. Builder Pattern ⭐

Builder is very useful when an object has **many optional or configurable properties**.

### Problem

Imagine creating an API request:

```js
const request = {
    url: "/users",
    method: "GET",
    headers: {...},
    timeout: 5000,
    retries: 3,
    cache: true,
    authentication: {...},
    compression: true
};
```

As the number of options grows, constructors can become ugly:

```js
new Request(
    url,
    method,
    headers,
    timeout,
    retries,
    cache,
    authentication,
    compression
);
```

Builder solves this by constructing the object step-by-step.

---

## Builder Example

```js
class QueryBuilder {

    constructor() {
        this.query = {
            filters: [],
            sort: null,
            limit: null,
            offset: null
        };
    }

    where(field, value) {
        this.query.filters.push({
            field,
            value
        });

        return this;
    }

    sortBy(field) {
        this.query.sort = field;

        return this;
    }

    limit(value) {
        this.query.limit = value;

        return this;
    }

    offset(value) {
        this.query.offset = value;

        return this;
    }

    build() {
        return this.query;
    }
}
```

Usage:

```js
const query = new QueryBuilder()
    .where("status", "active")
    .where("age", 25)
    .sortBy("createdAt")
    .limit(20)
    .offset(40)
    .build();

console.log(query);
```

Result:

```js
{
    filters: [
        { field: "status", value: "active" },
        { field: "age", value: 25 }
    ],
    sort: "createdAt",
    limit: 20,
    offset: 40
}
```

Notice:

```js
return this;
```

This enables **method chaining**.

---