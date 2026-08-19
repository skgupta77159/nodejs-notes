# 7. Repository Pattern ⭐

Repository Pattern separates **database access from business logic**.

### Without Repository

```js
async function createOrder(order) {

    const result = await db.query(
        "INSERT INTO orders ..."
    );

    // business logic
}
```

Business logic becomes tightly coupled to PostgreSQL.

### With Repository

```js
class OrderRepository {

    async create(order) {
        return db.query(
            "INSERT INTO orders ...",
            [order.userId, order.amount]
        );
    }

    async findById(id) {
        return db.query(
            "SELECT * FROM orders WHERE id = $1",
            [id]
        );
    }
}
```

Service:

```js
class OrderService {

    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    async createOrder(order) {

        // Business logic
        if (order.amount <= 0) {
            throw new Error("Invalid amount");
        }

        return this.orderRepository.create(order);
    }
}
```

### Architecture

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

### Benefits

You can replace:

```text
PostgreSQL
```

with:

```text
MongoDB
```

without rewriting the business logic.

---