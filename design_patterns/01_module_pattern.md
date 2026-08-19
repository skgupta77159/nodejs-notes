# 1. Module Pattern

Node.js naturally supports the **Module Pattern**.

The idea is:

> Keep related functionality together and expose only what other parts of the application need.

### Example

```js
// userService.js

const users = [];

function createUser(user) {
    users.push(user);
}

function getUser(id) {
    return users.find(user => user.id === id);
}

module.exports = {
    createUser,
    getUser
};
```

Then:

```js
const userService = require("./userService");

userService.createUser({
    id: 1,
    name: "Sushil"
});

console.log(userService.getUser(1));
```

The internal `users` array isn't directly exposed.

### Real-world use

```text
controllers/
services/
repositories/
utils/
middlewares/
```

Each module owns a particular responsibility.

### Interview point

> Node.js modules provide encapsulation by exposing only the required public API.

---