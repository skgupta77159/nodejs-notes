# 8. Dependency Injection ⭐

Dependency Injection means:

> Instead of a class creating its dependencies itself, dependencies are provided from outside.

### Bad

```js
class OrderService {

    constructor() {
        this.repository = new OrderRepository();
    }
}
```

Now `OrderService` is tightly coupled to `OrderRepository`.

### Better

```js
class OrderService {

    constructor(repository) {
        this.repository = repository;
    }
}
```

Usage:

```js
const repository = new OrderRepository();

const orderService = new OrderService(repository);
```

For testing:

```js
const fakeRepository = {
    create: async () => ({
        id: 1,
        amount: 500
    })
};

const service = new OrderService(fakeRepository);
```

Now you don't need a real database during unit testing.

### Real-world architecture

```text
           Application
                |
        Dependency Injection
                |
       ┌────────┼────────┐
       ↓        ↓        ↓
   DB Repo   Logger   Payment
```

---