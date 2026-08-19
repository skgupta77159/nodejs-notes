# 10. Decorator Pattern

Decorator adds functionality to an existing object **without modifying its original implementation**.

For example, suppose:

```js
class UserService {

    async getUser(id) {
        return db.getUser(id);
    }
}
```

We want caching.

Instead of changing `UserService`:

```js
class CachedUserService {

    constructor(userService, cache) {
        this.userService = userService;
        this.cache = cache;
    }

    async getUser(id) {

        const cached = await this.cache.get(id);

        if (cached) {
            return cached;
        }

        const user = await this.userService.getUser(id);

        await this.cache.set(id, user);

        return user;
    }
}
```

Now:

```js
const service = new CachedUserService(
    new UserService(),
    redis
);
```

You added caching without modifying the original service.

---