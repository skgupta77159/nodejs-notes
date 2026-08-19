# 12. Proxy Pattern

Proxy means:

> Put an object in front of another object to control access to it.

Common Node.js use cases:

```text
Caching
Authorization
Logging
Rate limiting
Lazy loading
```

Example:

```js
const userService = {
    async getUser(id) {
        console.log("Database call");
        return {
            id,
            name: "Sushil"
        };
    }
};

const proxy = new Proxy(userService, {
    get(target, property) {

        console.log(`Accessing ${property}`);

        return target[property];
    }
});

await proxy.getUser(1);
```

The Proxy controls access to `userService`.

---